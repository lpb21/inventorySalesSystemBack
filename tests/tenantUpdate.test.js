const { Tenant } = require('../src/models');
const tenantController = require('../src/controllers/tenantController');
const { resetDb } = require('./dbSetup');

async function seedTenant(overrides = {}) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 100000)}`;
  return Tenant.create({ name: 'Mi Negocio BD', slug: `t${stamp}`, ...overrides });
}

// Llama al controlador como lo haría Express y devuelve { status, body, error }.
function callUpdate({ id = 'current', body, user, tenantId }) {
  return new Promise((resolve) => {
    const res = {
      status(code) { this.statusCode = code; return this; },
      json(payload) { resolve({ status: this.statusCode, body: payload }); },
    };
    const req = { params: { id }, body, user, tenantId };
    tenantController.updateTenant(req, res, (error) => resolve({ error }));
  });
}

beforeEach(async () => {
  await resetDb();
});

describe('PUT /v1/tenants/:id — datos del negocio', () => {
  it('el owner actualiza nombre comercial, dirección y teléfono de su empresa', async () => {
    const tenant = await seedTenant();
    const result = await callUpdate({
      body: { business_name: '  Mi Negocio C.A. ', address: 'Calle 1', phone: '3001234567' },
      user: { userId: null, role: 'owner' },
      tenantId: tenant.id,
    });

    expect(result.status).toBe(200);
    const fresh = await Tenant.findByPk(tenant.id);
    expect(fresh.business_name).toBe('Mi Negocio C.A.');
    expect(fresh.address).toBe('Calle 1');
    expect(fresh.name).toBe('Mi Negocio BD'); // el nombre interno no cambia
  });

  it('ignora campos protegidos: créditos SMS, suscripción, plan', async () => {
    const tenant = await seedTenant();
    await callUpdate({
      body: {
        business_name: 'Tienda',
        sms_balance: 99999,
        sms_enabled: true,
        subscription_status: 'active',
        plan: 'enterprise',
        is_active: true,
      },
      user: { userId: null, role: 'owner' },
      tenantId: tenant.id,
    });

    const fresh = await Tenant.findByPk(tenant.id);
    expect(fresh.sms_balance).toBe(0);
    expect(fresh.sms_enabled).toBe(false);
    expect(fresh.subscription_status).toBe('trial');
  });

  it('un owner no puede modificar otra empresa', async () => {
    const mine = await seedTenant();
    const other = await seedTenant({ business_name: 'Ajena' });

    const result = await callUpdate({
      id: other.id,
      body: { business_name: 'Hackeada' },
      user: { userId: null, role: 'owner' },
      tenantId: mine.id,
    });

    expect(result.error).toBeDefined();
    expect(result.error.message).toMatch(/otra empresa/);
    expect((await Tenant.findByPk(other.id)).business_name).toBe('Ajena');
  });

  it('el superadmin sí puede modificar cualquier empresa', async () => {
    const other = await seedTenant();
    const result = await callUpdate({
      id: other.id,
      body: { business_name: 'Corregido por admin' },
      user: { userId: null, role: 'superadmin', isSuperadmin: true },
      tenantId: null,
    });

    expect(result.status).toBe(200);
    expect((await Tenant.findByPk(other.id)).business_name).toBe('Corregido por admin');
  });
});
