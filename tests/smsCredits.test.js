// Twilio nunca se llama: smsService está mockeado.
jest.mock('../src/services/smsService', () => ({
  sendSms: jest.fn(),
  getAccountBalance: jest.fn(),
  maskPhone: (p) => `***${String(p).slice(-4)}`,
}));

const { Tenant, User, Product, Customer, SmsLog, SmsCreditTransaction } = require('../src/models');
const smsService = require('../src/services/smsService');
const smsCreditService = require('../src/services/smsCreditService');
const customerNotificationService = require('../src/services/customerNotificationService');
const saleService = require('../src/services/saleService');
const customerPaymentService = require('../src/services/customerPaymentService');
const { resetDb } = require('./dbSetup');

async function seed({ smsEnabled = false, smsBalance = 0 } = {}) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 100000)}`;
  const tenant = await Tenant.create({
    name: 'Punto Test', slug: `t${stamp}`, sms_enabled: smsEnabled, sms_balance: smsBalance,
  });
  const customer = await Customer.create({
    tenant_id: tenant.id, name: 'Cliente SMS', phone_e164: '+573001234567',
    credit_limit: 0, credit_balance: 0,
  });
  return { tenant, customer };
}

const balanceOf = async (tenantId) => (await Tenant.findByPk(tenantId)).sms_balance;

beforeEach(async () => {
  await resetDb();
  smsService.sendSms.mockReset();
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('smsCreditService — movimientos del superadmin', () => {
  it('un tenant nuevo arranca deshabilitado y con saldo 0', async () => {
    const { tenant } = await seed();
    const fresh = await Tenant.findByPk(tenant.id);
    expect(fresh.sms_enabled).toBe(false);
    expect(fresh.sms_balance).toBe(0);
  });

  it('bono de bienvenida: +10 una sola vez', async () => {
    const { tenant } = await seed();
    const result = await smsCreditService.grantWelcomeBonus(tenant.id, null);
    expect(result.sms_balance).toBe(10);
    await expect(smsCreditService.grantWelcomeBonus(tenant.id, null)).rejects.toThrow(/bono de bienvenida/);
    expect(await balanceOf(tenant.id)).toBe(10);
  });

  it('bono de bienvenida: dos clics simultáneos no lo duplican', async () => {
    const { tenant } = await seed();
    const results = await Promise.allSettled([
      smsCreditService.grantWelcomeBonus(tenant.id, null),
      smsCreditService.grantWelcomeBonus(tenant.id, null),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await balanceOf(tenant.id)).toBe(10);
  });

  it('compra de paquete acredita los SMS y guarda el precio', async () => {
    const { tenant } = await seed();
    const result = await smsCreditService.purchasePackage(tenant.id, 'medium', null, 'Pago Nequi');
    expect(result.sms_balance).toBe(150);

    const tx = await SmsCreditTransaction.findOne({ where: { tenant_id: tenant.id, type: 'purchase' } });
    expect(tx.amount).toBe(150);
    expect(tx.price_cop).toBe(37000);
    expect(tx.package_code).toBe('medium');
  });

  it('paquete inválido es rechazado', async () => {
    const { tenant } = await seed();
    await expect(smsCreditService.purchasePackage(tenant.id, 'gigante', null)).rejects.toThrow(/Paquete inválido/);
  });

  it('ajuste manual: exige nota y no deja el saldo negativo', async () => {
    const { tenant } = await seed({ smsBalance: 5 });
    await expect(smsCreditService.adjust(tenant.id, -3, '', null)).rejects.toThrow(/nota/);
    await expect(smsCreditService.adjust(tenant.id, -6, 'error', null)).rejects.toThrow(/negativo/);

    const result = await smsCreditService.adjust(tenant.id, -3, 'Corrección', null);
    expect(result.sms_balance).toBe(2);
  });

  it('habilitar/deshabilitar no toca el saldo', async () => {
    const { tenant } = await seed({ smsBalance: 7 });
    const result = await smsCreditService.setEnabled(tenant.id, true, null);
    expect(result.sms_enabled).toBe(true);
    expect(result.sms_balance).toBe(7);
  });
});

describe('smsCreditService.reserveCredit', () => {
  it('tenant deshabilitado: no reserva', async () => {
    const { tenant } = await seed({ smsEnabled: false, smsBalance: 10 });
    expect(await smsCreditService.reserveCredit(tenant.id)).toEqual({ reserved: false, reason: 'disabled' });
    expect(await balanceOf(tenant.id)).toBe(10);
  });

  it('sin saldo: no reserva', async () => {
    const { tenant } = await seed({ smsEnabled: true, smsBalance: 0 });
    expect(await smsCreditService.reserveCredit(tenant.id)).toEqual({ reserved: false, reason: 'no_balance' });
  });

  it('reservas simultáneas nunca gastan más de lo que hay', async () => {
    const { tenant } = await seed({ smsEnabled: true, smsBalance: 2 });
    const results = await Promise.all(
      Array.from({ length: 6 }, () => smsCreditService.reserveCredit(tenant.id))
    );
    expect(results.filter((r) => r.reserved)).toHaveLength(2);
    expect(await balanceOf(tenant.id)).toBe(0);
  });
});

// Fiado real (venta a crédito) para notificar desde el "modal".
async function creditSale(tenant, customer, price = 18000) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 100000)}`;
  const owner = await User.create({
    tenant_id: tenant.id, name: 'Owner', email: `owner-${stamp}@t.com`,
    password_hash: 'x', role: 'owner',
  });
  const product = await Product.create({
    tenant_id: tenant.id, name: 'Pollo', unit: 'und', type: 'unit',
    price, cost: 1000, stock: 100, min_stock: 0,
  });
  return saleService.createSale(tenant.id, {
    payment_method: 'credit',
    customer_id: customer.id,
    items: [{ product_id: product.id, quantity: 1 }],
  }, owner.id);
}

describe('customerNotificationService — envío manual desde el modal', () => {
  it('registrar un fiado NO envía SMS automáticamente', async () => {
    const { tenant, customer } = await seed({ smsEnabled: true, smsBalance: 5 });
    await creditSale(tenant, customer);
    expect(smsService.sendSms).not.toHaveBeenCalled();
    expect(await balanceOf(tenant.id)).toBe(5);
  });

  it('botón del fiado: descuenta 1, log "sent" con sale_id y consumo en el libro', async () => {
    smsService.sendSms.mockResolvedValue({ ok: true, sid: 'SM1', segments: 1 });
    const { tenant, customer } = await seed({ smsEnabled: true, smsBalance: 3 });
    const sale = await creditSale(tenant, customer);

    const result = await customerNotificationService.notifySale(tenant.id, sale.id);

    expect(result).toMatchObject({ sent: true, to: '***4567', sms_balance: 2 });
    expect(smsService.sendSms).toHaveBeenCalledWith(
      '+573001234567',
      'Punto Test: fiado de $18.000 registrado. Saldo pendiente: $18.000',
      expect.objectContaining({ kind: 'credit_charge' })
    );
    expect(await balanceOf(tenant.id)).toBe(2);

    const log = await SmsLog.findOne({ where: { tenant_id: tenant.id } });
    expect(log.status).toBe('sent');
    expect(log.sale_id).toBe(sale.id);

    const tx = await SmsCreditTransaction.findOne({ where: { tenant_id: tenant.id, type: 'consumption' } });
    expect(tx.sms_log_id).toBe(log.id);
  });

  it('el mismo fiado no se puede notificar dos veces (ni con doble clic)', async () => {
    smsService.sendSms.mockResolvedValue({ ok: true, sid: 'SM1', segments: 1 });
    const { tenant, customer } = await seed({ smsEnabled: true, smsBalance: 5 });
    const sale = await creditSale(tenant, customer);

    const results = await Promise.allSettled([
      customerNotificationService.notifySale(tenant.id, sale.id),
      customerNotificationService.notifySale(tenant.id, sale.id),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.find((r) => r.status === 'rejected').reason.message).toMatch(/ya fue enviada/);
    expect(smsService.sendSms).toHaveBeenCalledTimes(1);
    expect(await balanceOf(tenant.id)).toBe(4);
  });

  it('Twilio rechaza (21614): devuelve el crédito y permite reintentar', async () => {
    smsService.sendSms.mockResolvedValueOnce({ ok: false, code: 21614, error: 'not a mobile number' });
    const { tenant, customer } = await seed({ smsEnabled: true, smsBalance: 3 });
    const sale = await creditSale(tenant, customer);

    const failed = await customerNotificationService.notifySale(tenant.id, sale.id);
    expect(failed).toMatchObject({ sent: false, reason: 'not_mobile' });
    expect(await balanceOf(tenant.id)).toBe(3);

    smsService.sendSms.mockResolvedValueOnce({ ok: true, sid: 'SM2', segments: 1 });
    const retry = await customerNotificationService.notifySale(tenant.id, sale.id);
    expect(retry.sent).toBe(true);
    expect(await balanceOf(tenant.id)).toBe(2);
  });

  it('sin saldo: no llama a Twilio, responde no_balance y deja log', async () => {
    const { tenant, customer } = await seed({ smsEnabled: true, smsBalance: 0 });
    const sale = await creditSale(tenant, customer);

    const result = await customerNotificationService.notifySale(tenant.id, sale.id);

    expect(result).toMatchObject({ sent: false, reason: 'no_balance' });
    expect(smsService.sendSms).not.toHaveBeenCalled();
    const log = await SmsLog.findOne({ where: { tenant_id: tenant.id } });
    expect(log.skip_reason).toBe('no_balance');
  });

  it('tenant sin SMS habilitado: responde disabled sin log', async () => {
    const { tenant, customer } = await seed({ smsEnabled: false, smsBalance: 10 });
    const sale = await creditSale(tenant, customer);

    const result = await customerNotificationService.notifySale(tenant.id, sale.id);

    expect(result).toMatchObject({ sent: false, reason: 'disabled' });
    expect(await SmsLog.count({ where: { tenant_id: tenant.id } })).toBe(0);
  });

  it('cliente con avisos desactivados en Configuración: rechaza sin gastar crédito', async () => {
    const { tenant, customer } = await seed({ smsEnabled: true, smsBalance: 10 });
    const sale = await creditSale(tenant, customer);
    await customer.update({ whatsapp_notifications_enabled: false });

    await expect(customerNotificationService.notifySale(tenant.id, sale.id)).rejects.toThrow(/desactivados/);
    expect(await balanceOf(tenant.id)).toBe(10);
  });

  it('abono: registerPayment guarda el abono y el botón lo notifica una sola vez', async () => {
    smsService.sendSms.mockResolvedValue({ ok: true, sid: 'SM3', segments: 1 });
    const { tenant, customer } = await seed({ smsEnabled: true, smsBalance: 5 });
    await creditSale(tenant, customer, 20000);

    const payment = await customerPaymentService.registerPayment(tenant.id, customer.id, { amount: 5000 }, null);
    expect(payment.payment_id).toBeDefined();
    expect(smsService.sendSms).not.toHaveBeenCalled();

    const result = await customerNotificationService.notifyPayment(tenant.id, customer.id, payment.payment_id);
    expect(result.sent).toBe(true);
    expect(smsService.sendSms).toHaveBeenCalledWith(
      '+573001234567',
      'Punto Test: abono de $5.000 recibido. Saldo pendiente: $15.000',
      expect.objectContaining({ kind: 'credit_payment' })
    );

    await expect(
      customerNotificationService.notifyPayment(tenant.id, customer.id, payment.payment_id)
    ).rejects.toThrow(/ya fue enviada/);
  });
});
