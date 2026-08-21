const db = require('../src/models');

/**
 * Genera un sufijo único y alfanumérico (sin puntos ni guiones)
 * para slugs/emails, evitando el error isAlphanumeric del slug.
 */
function uniqueSuffix() {
  return `${Date.now()}${Math.floor(Math.random() * 100000)}`;
}

/**
 * Crea un tenant completo con owner, y opcionalmente producto/cliente/proveedor.
 * Devuelve las entidades creadas.
 */
async function createTenant(label = 'T') {
  const s = uniqueSuffix();

  const tenant = await db.Tenant.create({ name: `Tenant ${label}`, slug: `${label.toLowerCase()}${s}` });
  const owner = await db.User.create({
    tenant_id: tenant.id, name: `Owner ${label}`, email: `owner-${label}-${s}@t.com`,
    password_hash: 'x', role: 'owner',
  });
  const product = await db.Product.create({
    tenant_id: tenant.id, name: `Producto ${label}`, unit: 'und', type: 'unit',
    price: 1000, cost: 500, stock: 10, min_stock: 1,
  });
  const customer = await db.Customer.create({
    tenant_id: tenant.id, name: `Cliente ${label}`, credit_limit: 1000000, credit_balance: 0,
  });
  const supplier = await db.Supplier.create({
    tenant_id: tenant.id, name: `Proveedor ${label}`,
  });

  return { tenant, owner, product, customer, supplier };
}

module.exports = { uniqueSuffix, createTenant };