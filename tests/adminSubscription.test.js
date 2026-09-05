const db = require('../src/models');
const { Tenant, TenantSubscription, Category } = db;
const adminSubscriptionService = require('../src/services/adminSubscriptionService');
const { createTenant, uniqueSuffix } = require('./helpers');
const { resetDb } = require('./dbSetup');
const { DEFAULT_CATEGORIES } = require('../src/utils/defaultCategories');

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

describe('createTenant siembra categorías por defecto', () => {
  test('un cliente nuevo nace con las categorías por defecto', async () => {
    const s = uniqueSuffix();
    const result = await adminSubscriptionService.createTenant({
      business_name: 'Salsamentaría Test',
      slug: `test${s}`,
      owner_name: 'Owner Test',
      owner_email: `owner${s}@t.com`,
      owner_password: 'secret123',
      period: 'monthly',
    }, 'actor-test');

    const cats = await Category.findAll({ where: { tenant_id: result.tenant_id } });

    expect(cats).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(cats.map((c) => c.name).sort()).toEqual([...DEFAULT_CATEGORIES].sort());
    expect(cats.every((c) => c.is_active === true)).toBe(true);
    expect(cats.every((c) => c.tenant_id === result.tenant_id)).toBe(true);
  });

  test('la lista por defecto tiene 7 categorías e incluye Gaseosas y refrescos', () => {
    expect(DEFAULT_CATEGORIES).toHaveLength(7);
    expect(DEFAULT_CATEGORIES).toContain('Gaseosas y refrescos');
  });
});