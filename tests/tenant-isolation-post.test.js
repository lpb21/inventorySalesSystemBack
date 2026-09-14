const db = require('../src/models');
const { Category, CashRegister } = db;
const productService = require('../src/services/productService');
const saleService = require('../src/services/saleService');
const inventoryService = require('../src/services/inventoryService');
const cashRegisterService = require('../src/services/cashRegisterService');
const { createTenant } = require('./helpers');
const { resetDb } = require('./dbSetup');

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await db.sequelize.close();
});

describe('Aislamiento multi-tenant (crear con IDs de otro tenant)', () => {
  test('A NO puede crear un producto con category_id de B', async () => {
    const a = await createTenant('A');
    const b = await createTenant('B');
    const catB = await Category.create({ tenant_id: b.tenant.id, name: 'Categoria B' });

    await expect(
      productService.createProduct(a.tenant.id, {
        name: 'Producto tramposo', unit: 'und', type: 'unit',
        price: 1000, cost: 500, stock: 5, min_stock: 1,
        category_id: catB.id,
      }, a.owner.id)
    ).rejects.toThrow(/no encontrada/i);
  });

  test('A NO puede crear un producto con supplier_id de B', async () => {
    const a = await createTenant('A');
    const b = await createTenant('B');

    await expect(
      productService.createProduct(a.tenant.id, {
        name: 'Producto tramposo', unit: 'und', type: 'unit',
        price: 1000, cost: 500, stock: 5, min_stock: 1,
        supplier_id: b.supplier.id,
      }, a.owner.id)
    ).rejects.toThrow(/no encontrado/i);
  });

  test('A NO puede vender a crédito usando un cliente de B', async () => {
    const a = await createTenant('A');
    const b = await createTenant('B');

    await expect(
      saleService.createSale(a.tenant.id, {
        payment_method: 'credit',
        customer_id: b.customer.id,
        subtotal: 1000, total: 1000,
        items: [{ product_id: a.product.id, quantity: 1, unit_price: 1000 }],
      }, a.owner.id)
    ).rejects.toThrow(/cliente no encontrado/i);
  });

  test('A NO puede vender usando un producto de B', async () => {
    const a = await createTenant('A');
    const b = await createTenant('B');

    await expect(
      saleService.createSale(a.tenant.id, {
        payment_method: 'cash', payment_received: 1000,
        subtotal: 1000, total: 1000,
        items: [{ product_id: b.product.id, quantity: 1, unit_price: 1000 }],
      }, a.owner.id)
    ).rejects.toThrow();
  });
});

describe('Aislamiento multi-tenant (inventario)', () => {
  test('A NO puede ajustar el stock de un producto de B', async () => {
    const a = await createTenant('A');
    const b = await createTenant('B');

    await expect(
      inventoryService.recordMovement(a.tenant.id, {
        product_id: b.product.id, quantity: 5, type: 'in',
        reason: 'intento cruzado', user_id: a.owner.id,
      })
    ).rejects.toThrow(/no encontrado/i);

    // El stock de B sigue intacto (10 del helper)
    const untouched = await db.Product.findByPk(b.product.id);
    expect(parseFloat(untouched.stock)).toBe(10);
  });
});

describe('Aislamiento multi-tenant (caja)', () => {
  test('A NO puede leer ni cerrar un turno de caja de B', async () => {
    const a = await createTenant('A');
    const b = await createTenant('B');

    // B abre un turno
    const shiftB = await cashRegisterService.openShift(b.tenant.id, {
      name: 'Turno B', opening_amount: 100000,
    }, b.owner.id);

    // A intenta leer el turno de B
    await expect(
      cashRegisterService.getShiftById(a.tenant.id, shiftB.id, a.owner.id, 'owner')
    ).rejects.toThrow(/no encontrado/i);

    // A intenta cerrar el turno de B
    await expect(
      cashRegisterService.closeShift(a.tenant.id, shiftB.id, { closing_amount: 100000 }, a.owner.id)
    ).rejects.toThrow(/no encontrado/i);

    // El turno de B sigue abierto
    const stillOpen = await CashRegister.findByPk(shiftB.id);
    expect(stillOpen.status).toBe('open');
  });
});