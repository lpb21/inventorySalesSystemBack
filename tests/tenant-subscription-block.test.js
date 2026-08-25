const db = require('../src/models');
const { Tenant, TenantSubscription } = db;
const tenantMiddleware = require('../src/middlewares/tenantMiddleware');
const { createTenant } = require('./helpers');
const { resetDb } = require('./dbSetup');

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await db.sequelize.close();
});

// Simula el ciclo req/res/next de Express para invocar el middleware directamente.
// Devuelve { error, nextCalled } para verificar si dejó pasar o bloqueó.
async function runMiddleware(tenantId) {
  const req = { user: { tenantId, role: 'cashier', isSuperadmin: false } };
  const res = {};
  let capturedError = null;
  let nextCalled = false;

  await tenantMiddleware(req, res, (err) => {
    if (err) capturedError = err;
    else nextCalled = true;
  });

  return { error: capturedError, nextCalled, req };
}

// Helper: crea/actualiza la suscripción de un tenant con una fecha de fin dada
async function setSubscription(tenantId, periodEnd, graceUntil = null) {
  await TenantSubscription.create({
    tenant_id: tenantId,
    provider: 'manual',
    plan_code: 'monthly',
    status: 'active',
    current_period_start: new Date(),
    current_period_end: periodEnd,
    grace_until: graceUntil,
  });
}

describe('Bloqueo por vencimiento de suscripción (tenantMiddleware)', () => {
  test('deja pasar si la suscripción está vigente', async () => {
    const { tenant } = await createTenant('A');
    const futuro = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // +30 días
    await setSubscription(tenant.id, futuro);

    const { error, nextCalled } = await runMiddleware(tenant.id);

    expect(error).toBeNull();
    expect(nextCalled).toBe(true);
  });

  test('BLOQUEA si la suscripción está vencida y sin gracia', async () => {
    const { tenant } = await createTenant('A');
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000); // -1 día
    await setSubscription(tenant.id, ayer);

    const { error, nextCalled } = await runMiddleware(tenant.id);

    expect(nextCalled).toBe(false);
    expect(error).not.toBeNull();
    expect(error.message).toMatch(/vencida/i);
  });

  test('deja pasar si está vencida PERO en periodo de gracia vigente', async () => {
    const { tenant } = await createTenant('A');
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);       // venció ayer
    const graciaFutura = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // gracia +3 días
    await setSubscription(tenant.id, ayer, graciaFutura);

    const { error, nextCalled } = await runMiddleware(tenant.id);

    expect(error).toBeNull();
    expect(nextCalled).toBe(true);
  });

  test('BLOQUEA si está vencida y la gracia también pasó', async () => {
    const { tenant } = await createTenant('A');
    const hace10dias = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const graciaVencida = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // gracia venció hace 2 días
    await setSubscription(tenant.id, hace10dias, graciaVencida);

    const { error, nextCalled } = await runMiddleware(tenant.id);

    expect(nextCalled).toBe(false);
    expect(error.message).toMatch(/vencida/i);
  });

  test('deja pasar si el tenant no tiene suscripción configurada (no rompe)', async () => {
    const { tenant } = await createTenant('A');
    // Sin crear suscripción → no debe bloquear (tenants viejos sin config)

    const { error, nextCalled } = await runMiddleware(tenant.id);

    expect(error).toBeNull();
    expect(nextCalled).toBe(true);
  });
});