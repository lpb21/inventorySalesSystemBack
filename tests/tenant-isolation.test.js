const db = require('../src/models');
const { Product } = db;
const productService = require('../src/services/productService');
const { resetDb } = require('./dbSetup');

// Siembra dos tenants independientes, cada uno con su propio producto
async function seedTwoTenants() {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 100000)}`;

  const tenantA = await db.Tenant.create({ name: 'Tenant A', slug: `ta${stamp}` });
  const ownerA = await db.User.create({
    tenant_id: tenantA.id, name: 'Owner A', email: `a-${stamp}@t.com`,
    password_hash: 'x', role: 'owner',
  });
  const productA = await Product.create({
    tenant_id: tenantA.id, name: 'Producto de A', unit: 'und', type: 'unit',
    price: 1000, cost: 500, stock: 10, min_stock: 1,
  });

  const tenantB = await db.Tenant.create({ name: 'Tenant B', slug: `tb${stamp}` });
  const ownerB = await db.User.create({
    tenant_id: tenantB.id, name: 'Owner B', email: `b-${stamp}@t.com`,
    password_hash: 'x', role: 'owner',
  });
  const productB = await Product.create({
    tenant_id: tenantB.id, name: 'Producto de B', unit: 'und', type: 'unit',
    price: 2000, cost: 1000, stock: 20, min_stock: 1,
  });

  return { tenantA, ownerA, productA, tenantB, ownerB, productB };
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await db.sequelize.close();
});

describe('Aislamiento multi-tenant (productos)', () => {
  test('un tenant NO puede leer un producto de otro tenant por ID', async () => {
    const { tenantA, productB } = await seedTwoTenants();

    // Tenant A intenta leer el producto de B → debe fallar (no encontrado)
    await expect(
      productService.getProductById(tenantA.id, productB.id)
    ).rejects.toThrow(/no encontrado/i);
  });

  test('el listado de un tenant solo devuelve SUS productos', async () => {
    const { tenantA, productA } = await seedTwoTenants();

    const result = await productService.getProducts(tenantA.id, {});

    // Solo debe ver el producto de A, ninguno de B
    expect(result.products).toHaveLength(1);
    expect(result.products[0].id).toBe(productA.id);
    expect(result.products[0].name).toBe('Producto de A');
  });

  test('un tenant NO puede actualizar un producto de otro tenant', async () => {
    const { tenantA, productB } = await seedTwoTenants();

    // Tenant A intenta modificar el producto de B → debe fallar
    await expect(
      productService.updateProduct(tenantA.id, productB.id, { price: 99999 }, null)
    ).rejects.toThrow(/no encontrado/i);

    // Y confirmamos que el producto de B NO cambió en la BD
    const untouched = await Product.findByPk(productB.id);
    expect(Number(untouched.price)).toBe(2000);
  });

  test('un tenant NO puede borrar un producto de otro tenant', async () => {
    const { tenantA, productB } = await seedTwoTenants();

    await expect(
      productService.deleteProduct(tenantA.id, productB.id, null)
    ).rejects.toThrow(/no encontrado/i);

    // El producto de B sigue existiendo
    const stillThere = await Product.findByPk(productB.id);
    expect(stillThere).not.toBeNull();
  });
});