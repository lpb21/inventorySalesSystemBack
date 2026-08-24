const db = require('../src/models');
const { Product, InventoryMovement } = db;
const inventoryService = require('../src/services/inventoryService');
const { createTenant } = require('./helpers');
const { resetDb } = require('./dbSetup');

// Helper: crea un producto en un tenant
async function makeProduct(tenantId, name, unit, stock) {
  return await Product.create({
    tenant_id: tenantId, name, unit, type: 'unit',
    price: 10000, cost: 5000, stock, min_stock: 1,
  });
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await db.sequelize.close();
});

describe('Despiece / transformación de inventario', () => {
  test('descuenta el origen e incrementa los destinos', async () => {
    const { tenant, owner } = await createTenant('A');
    const pollo = await makeProduct(tenant.id, 'Pollo', 'und', 35);
    const pechuga = await makeProduct(tenant.id, 'Pechuga', 'kg', 0);
    const alas = await makeProduct(tenant.id, 'Alas', 'kg', 0);

    const result = await inventoryService.transform(tenant.id, {
      source_product_id: pollo.id,
      source_quantity: 1,
      targets: [
        { product_id: pechuga.id, quantity: 0.8 },
        { product_id: alas.id, quantity: 0.3 },
      ],
      reason: 'Despiece de prueba',
    }, owner.id);

    expect(result.source.stock_after).toBe(34);

    const polloDb = await Product.findByPk(pollo.id);
    const pechugaDb = await Product.findByPk(pechuga.id);
    const alasDb = await Product.findByPk(alas.id);

    expect(polloDb.stock).toBe(34);      // 35 - 1
    expect(pechugaDb.stock).toBe(0.8);   // 0 + 0.8
    expect(alasDb.stock).toBe(0.3);      // 0 + 0.3
  });

  test('registra un movimiento transformation por origen y por destino', async () => {
    const { tenant, owner } = await createTenant('A');
    const pollo = await makeProduct(tenant.id, 'Pollo', 'und', 10);
    const pechuga = await makeProduct(tenant.id, 'Pechuga', 'kg', 0);

    await inventoryService.transform(tenant.id, {
      source_product_id: pollo.id,
      source_quantity: 1,
      targets: [{ product_id: pechuga.id, quantity: 0.8 }],
    }, owner.id);

    const movements = await InventoryMovement.findAll({
      where: { tenant_id: tenant.id, type: 'transformation' },
    });
    expect(movements).toHaveLength(2); // 1 origen + 1 destino
  });

  test('permite merma (la suma de destinos puede ser menor al origen)', async () => {
    const { tenant, owner } = await createTenant('A');
    const pollo = await makeProduct(tenant.id, 'Pollo', 'und', 5);
    const pechuga = await makeProduct(tenant.id, 'Pechuga', 'kg', 0);

    // 1 pollo → solo 0.5 kg (el resto es merma, no se registra) → no debe fallar
    const result = await inventoryService.transform(tenant.id, {
      source_product_id: pollo.id,
      source_quantity: 1,
      targets: [{ product_id: pechuga.id, quantity: 0.5 }],
    }, owner.id);

    expect(result.source.stock_after).toBe(4);
  });

  test('rechaza si no hay stock suficiente en el origen', async () => {
    const { tenant, owner } = await createTenant('A');
    const pollo = await makeProduct(tenant.id, 'Pollo', 'und', 2);
    const pechuga = await makeProduct(tenant.id, 'Pechuga', 'kg', 0);

    await expect(
      inventoryService.transform(tenant.id, {
        source_product_id: pollo.id,
        source_quantity: 5, // más de lo que hay (2)
        targets: [{ product_id: pechuga.id, quantity: 1 }],
      }, owner.id)
    ).rejects.toThrow(/insuficiente/i);
  });

  test('rechaza si un destino es el mismo origen', async () => {
    const { tenant, owner } = await createTenant('A');
    const pollo = await makeProduct(tenant.id, 'Pollo', 'und', 10);

    await expect(
      inventoryService.transform(tenant.id, {
        source_product_id: pollo.id,
        source_quantity: 1,
        targets: [{ product_id: pollo.id, quantity: 1 }],
      }, owner.id)
    ).rejects.toThrow(/no puede ser también un destino/i);
  });

  test('no puede despiezar un producto de otro tenant (aislamiento)', async () => {
    const a = await createTenant('A');
    const b = await createTenant('B');
    const polloA = await makeProduct(a.tenant.id, 'Pollo A', 'und', 10);
    const pechugaB = await makeProduct(b.tenant.id, 'Pechuga B', 'kg', 0);

    // Tenant A intenta usar como destino un producto de B → no encontrado
    await expect(
      inventoryService.transform(a.tenant.id, {
        source_product_id: polloA.id,
        source_quantity: 1,
        targets: [{ product_id: pechugaB.id, quantity: 0.5 }],
      }, a.owner.id)
    ).rejects.toThrow(/no encontrado/i);
  });
});