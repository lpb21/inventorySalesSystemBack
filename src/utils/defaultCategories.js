/**
 * Categorías por defecto para una salsamentaría.
 * Se siembran al crear un cliente nuevo para evitar el "estado vacío"
 * (lo primero que ve un owner al entrar). La lista y la lógica viven aquí,
 * centralizadas, para poder reusarlas más adelante (p. ej. un botón
 * "restaurar categorías sugeridas"): una sola fuente de verdad, varios disparadores.
 */
const { Category } = require('../models');

const DEFAULT_CATEGORIES = [
  'Embutidos',
  'Quesos',
  'Pollo',
  'Carnes de cerdo',
  'Lácteos y huevos',
  'Gaseosas y refrescos',
  'Abarrotes / Otros',
];

/**
 * Siembra las categorías por defecto para un tenant.
 * @param {string} tenantId - id del tenant destino
 * @param {object} [transaction] - transacción Sequelize opcional (para atar el sembrado a createTenant)
 * @returns {Promise<Array>} categorías creadas
 */
async function seedDefaultCategories(tenantId, transaction = null) {
  const rows = DEFAULT_CATEGORIES.map((name) => ({ tenant_id: tenantId, name }));
  return Category.bulkCreate(rows, { transaction });
}

module.exports = { DEFAULT_CATEGORIES, seedDefaultCategories };