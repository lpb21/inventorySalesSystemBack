const db = require('../src/models');
const { sequelize, Tenant, User, Product, Customer, CashRegister, Sale, SaleItem, InventoryMovement } = db;
const saleService = require('../src/services/saleService');
const { resetDb } = require('./dbSetup');

// Siembra los datos mínimos para una prueba y devuelve las entidades creadas
async function seed() {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 100000)}`;
  const tenant = await Tenant.create({ name: 'Test Tenant', slug: `t${stamp}` });
  const owner = await User.create({
    tenant_id: tenant.id, name: 'Owner', email: `owner-${stamp}@t.com`,
    password_hash: 'x', role: 'owner',
  });
  const cashier = await User.create({
    tenant_id: tenant.id, name: 'Cajero', email: `cash-${stamp}@t.com`,
    password_hash: 'x', role: 'cashier',
  });
  const product = await Product.create({
    tenant_id: tenant.id, name: 'Pollo Entero', unit: 'und', type: 'unit',
    price: 18000, cost: 14000, stock: 100, min_stock: 5,
  });
  const customer = await Customer.create({
    tenant_id: tenant.id, name: 'Cliente QA', credit_limit: 100000000, credit_balance: 0,
  });
  return { tenant, owner, cashier, product, customer };
}

beforeEach(async () => {
  await resetDb();   // ← antes era sequelize.sync({ force: true })
});

afterAll(async () => {
  await sequelize.close();
});

describe('Bugs de plata (Fase 2)', () => {
  test('createSale usa el precio de la BD, ignora el que manda el cliente', async () => {
    const { tenant, owner, product } = await seed();

    const sale = await saleService.createSale(tenant.id, {
      payment_method: 'cash',
      payment_received: 100000,
      subtotal: 1,      // basura
      total: 1,         // basura
      items: [{ product_id: product.id, quantity: 1, unit_price: 1 }], // precio falso
    }, owner.id);

    const persisted = await Sale.findByPk(sale.id, {
      include: [{ model: SaleItem, as: 'items' }],
    });
    expect(Number(persisted.total)).toBe(18000);            // no 1
    expect(Number(persisted.items[0].unit_price)).toBe(18000); // no 1
  });

  test('cancelSale revierte el credit_balance del cliente', async () => {
    const { tenant, owner, product, customer } = await seed();

    const sale = await saleService.createSale(tenant.id, {
      payment_method: 'credit',
      customer_id: customer.id,
      subtotal: 1, total: 1,
      items: [{ product_id: product.id, quantity: 1, unit_price: 1 }],
    }, owner.id);

    let c = await Customer.findByPk(customer.id);
    expect(Number(c.credit_balance)).toBe(18000);

    await saleService.cancelSale(tenant.id, sale.id, owner.id, 'test reversa credito');

    c = await Customer.findByPk(customer.id);
    expect(Number(c.credit_balance)).toBe(0);
  });

  test('cancelSale revierte el efectivo de la caja', async () => {
    const { tenant, cashier, product } = await seed();

    const register = await CashRegister.create({
      tenant_id: tenant.id, user_id: cashier.id, name: 'Caja QA',
      opening_amount: 0, cash_in_drawer: 0, expected_amount: 0,
      status: 'open', opened_at: new Date(),
    });

    const sale = await saleService.createSale(tenant.id, {
      payment_method: 'cash',
      payment_received: 100000,
      subtotal: 1, total: 1,
      items: [{ product_id: product.id, quantity: 1, unit_price: 1 }],
    }, cashier.id);

    let r = await CashRegister.findByPk(register.id);
    expect(Number(r.cash_in_drawer)).toBe(18000);

    await saleService.cancelSale(tenant.id, sale.id, cashier.id, 'test reversa caja');
    r = await CashRegister.findByPk(register.id);
    expect(Number(r.cash_in_drawer)).toBe(0);
  });

  test('la BD rechaza un inventory_movement con type invalido (migracion 001)', async () => {
    const { tenant, owner, product } = await seed();

    await expect(
      InventoryMovement.create({
        tenant_id: tenant.id,
        product_id: product.id,
        user_id: owner.id,
        type: 'in',            // tipo inválido: la BD debe rechazarlo
        quantity: 1,
        stock_before: 10,
        stock_after: 11,
      })
    ).rejects.toThrow();
  });
});