const db = require('../src/models');
const { Tenant, TenantSubscription } = db;
const adminSubscriptionService = require('../src/services/adminSubscriptionService');
const { createTenant } = require('./helpers');
const { resetDb } = require('./dbSetup');

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await db.sequelize.close();
});

describe('Activación de suscripción (admin)', () => {
  test('activa un tenant con periodo monthly y crea la suscripción', async () => {
    const { tenant, owner } = await createTenant('A');

    const result = await adminSubscriptionService.activate(tenant.id, 'monthly', owner.id);

    expect(result.status).toBe('active');
    expect(result.period).toBe('monthly');

    // Verifica en la BD que la suscripción quedó creada y activa
    const sub = await TenantSubscription.findOne({ where: { tenant_id: tenant.id } });
    expect(sub).not.toBeNull();
    expect(sub.status).toBe('active');

    // El vencimiento cae a las 08:30 UTC (3:30 AM Colombia)
    expect(new Date(sub.current_period_end).getUTCHours()).toBe(8);
    expect(new Date(sub.current_period_end).getUTCMinutes()).toBe(30);
  });

  test('sincroniza el subscription_status del tenant', async () => {
    const { tenant, owner } = await createTenant('A');

    await adminSubscriptionService.activate(tenant.id, 'trial', owner.id);

    // La otra fuente de verdad (tabla tenants) también debe reflejar el estado
    const reloaded = await Tenant.findByPk(tenant.id);
    expect(reloaded.subscription_status).toBe('trial');
    expect(reloaded.is_active).toBe(true);
  });

  test('renovar un tenant que ya tenía suscripción actualiza las fechas', async () => {
    const { tenant, owner } = await createTenant('A');

    // Primera activación (trial, 7 días)
    await adminSubscriptionService.activate(tenant.id, 'trial', owner.id);
    const sub1 = await TenantSubscription.findOne({ where: { tenant_id: tenant.id } });
    const end1 = new Date(sub1.current_period_end);

    // Renovación a yearly (365 días) → el fin debe ser mucho más lejano
    await adminSubscriptionService.activate(tenant.id, 'yearly', owner.id);
    const sub2 = await TenantSubscription.findOne({ where: { tenant_id: tenant.id } });
    const end2 = new Date(sub2.current_period_end);

    expect(sub2.status).toBe('active');       // yearly => active (ya no trial)
    expect(end2.getTime()).toBeGreaterThan(end1.getTime());  // fecha más lejana

    // Y sigue habiendo UNA sola fila de suscripción (renovó, no duplicó)
    const count = await TenantSubscription.count({ where: { tenant_id: tenant.id } });
    expect(count).toBe(1);
  });

  test('rechaza un periodo inválido', async () => {
    const { tenant, owner } = await createTenant('A');

    await expect(
      adminSubscriptionService.activate(tenant.id, 'lifetime', owner.id)
    ).rejects.toThrow(/periodo inválido/i);
  });

  test('rechaza activar un tenant que no existe', async () => {
    const { owner } = await createTenant('A');
    const fakeId = '00000000-0000-0000-0000-000000000000';

    await expect(
      adminSubscriptionService.activate(fakeId, 'monthly', owner.id)
    ).rejects.toThrow(/no encontrado/i);
  });
});