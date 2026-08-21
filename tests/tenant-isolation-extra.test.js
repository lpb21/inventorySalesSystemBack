const db = require('../src/models');
const { Customer, Supplier } = db;
const supplierService = require('../src/services/supplierService');
const saleService = require('../src/services/saleService');
const { createTenant } = require('./helpers');
const { resetDb } = require('./dbSetup');

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await db.sequelize.close();
});

describe('Aislamiento multi-tenant (proveedores)', () => {
  test('un tenant NO puede leer un proveedor de otro tenant', async () => {
    const a = await createTenant('A');
    const b = await createTenant('B');

    await expect(
      supplierService.getSupplierById(a.tenant.id, b.supplier.id)
    ).rejects.toThrow(/no encontrado/i);
  });

  test('un tenant NO puede actualizar ni borrar un proveedor de otro', async () => {
    const a = await createTenant('A');
    const b = await createTenant('B');

    await expect(
      supplierService.updateSupplier(a.tenant.id, b.supplier.id, { name: 'Hackeado' }, null)
    ).rejects.toThrow(/no encontrado/i);

    await expect(
      supplierService.deleteSupplier(a.tenant.id, b.supplier.id, null)
    ).rejects.toThrow(/no encontrado/i);

    // El proveedor de B sigue intacto
    const untouched = await Supplier.findByPk(b.supplier.id);
    expect(untouched).not.toBeNull();
    expect(untouched.name).toBe('Proveedor B');
  });
});

describe('Aislamiento multi-tenant (ventas)', () => {
  test('un tenant NO puede leer una venta de otro tenant', async () => {
    const a = await createTenant('A');
    const b = await createTenant('B');

    // B crea una venta real
    const saleB = await saleService.createSale(b.tenant.id, {
      payment_method: 'cash', payment_received: 100000, subtotal: 1, total: 1,
      items: [{ product_id: b.product.id, quantity: 1, unit_price: 1 }],
    }, b.owner.id);

    // A intenta leer la venta de B → no encontrada
    await expect(
      saleService.getSaleById(a.tenant.id, saleB.id)
    ).rejects.toThrow(/no encontrada/i);
  });
});

describe('Aislamiento multi-tenant (clientes)', () => {
  test('a nivel de modelo, un Customer no aparece bajo otro tenant', async () => {
    const a = await createTenant('A');
    const b = await createTenant('B');

    // Buscar el cliente de B usando el tenant de A → null (aislado)
    const crossRead = await Customer.findOne({
      where: { id: b.customer.id, tenant_id: a.tenant.id },
    });
    expect(crossRead).toBeNull();

    // Pero con su tenant correcto, sí existe
    const properRead = await Customer.findOne({
      where: { id: b.customer.id, tenant_id: b.tenant.id },
    });
    expect(properRead).not.toBeNull();
  });
});