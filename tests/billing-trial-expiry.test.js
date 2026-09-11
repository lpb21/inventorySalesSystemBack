const db = require('../src/models');
const { Tenant, TenantSubscription } = db;
const billingService = require('../src/services/billingService');
const adminSubscriptionService = require('../src/services/adminSubscriptionService');
const { createTenant } = require('./helpers');
const { resetDb } = require('./dbSetup');

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await db.sequelize.close();
});

describe('Cancelación automática de suscripciones vencidas', () => {
  test('cancela el acceso de un trial que ya venció', async () => {
    const { tenant, owner } = await createTenant('A');

    // Activa un trial (vence en 7 días)
    await adminSubscriptionService.activate(tenant.id, 'trial', owner.id);

    // Simula que el periodo terminó en el pasado
    await TenantSubscription.update(
      { current_period_end: new Date(Date.now() - 60 * 60 * 1000) },
      { where: { tenant_id: tenant.id } }
    );

    const result = await billingService.enforceOverdueSubscriptions();

    expect(result.expiredTrials).toBe(1);

    const sub = await TenantSubscription.findOne({ where: { tenant_id: tenant.id } });
    expect(sub.status).toBe('cancelled');
    expect(sub.grace_until).toBeNull();

    const reloaded = await Tenant.findByPk(tenant.id);
    expect(reloaded.subscription_status).toBe('cancelled');
    expect(reloaded.is_active).toBe(false);
  });

  test('no toca un trial que todavía está vigente', async () => {
    const { tenant, owner } = await createTenant('B');

    await adminSubscriptionService.activate(tenant.id, 'trial', owner.id);

    const result = await billingService.enforceOverdueSubscriptions();

    expect(result.expiredTrials).toBe(0);

    const sub = await TenantSubscription.findOne({ where: { tenant_id: tenant.id } });
    expect(sub.status).toBe('trial');

    const reloaded = await Tenant.findByPk(tenant.id);
    expect(reloaded.subscription_status).toBe('trial');
    expect(reloaded.is_active).toBe(true);
  });

  test('un trial vigente reporta acceso al sistema', async () => {
    const { tenant, owner } = await createTenant('C');

    await adminSubscriptionService.activate(tenant.id, 'trial', owner.id);

    const result = await billingService.getTenantSubscription(tenant.id);

    expect(result.subscription.status).toBe('trial');
    expect(result.can_access_system).toBe(true);
    expect(result.has_active_subscription).toBe(true);
    expect(result.needs_attention).toBe(false);
  });
});
