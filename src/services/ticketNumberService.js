/**
 * Ticket Number Service
 * Genera números de ticket consecutivos por tenant y año, con formato AÑO-0000001.
 * Usa SELECT ... FOR UPDATE sobre la fila del contador para garantizar
 * unicidad bajo concurrencia (dos ventas simultáneas nunca repiten número).
 */
const { sequelize } = require('../models');

const PAD_LENGTH = 7; // 7 dígitos: 0000001

/**
 * Genera el siguiente número de ticket para un tenant.
 * DEBE llamarse dentro de una transacción existente (la de la venta).
 *
 * @param {string} tenantId
 * @param {object} transaction - la transacción de Sequelize en curso
 * @returns {Promise<string>} - el número formateado, ej. "2026-0000001"
 */
async function generateTicketNumber(tenantId, transaction) {
  const year = new Date().getFullYear();

  // 1) Asegura que exista la fila del contador para (tenant, año).
  //    Si es la primera venta del año, la crea con last_number = 0.
  //    ON CONFLICT DO NOTHING evita error si ya existe (o si dos ventas
  //    intentan crearla a la vez).
  await sequelize.query(
    `INSERT INTO ticket_counters (id, tenant_id, year, last_number, created_at, updated_at)
     VALUES (gen_random_uuid(), :tenantId, :year, 0, NOW(), NOW())
     ON CONFLICT (tenant_id, year) DO NOTHING`,
    {
      replacements: { tenantId, year },
      transaction,
    }
  );

  // 2) Bloquea la fila del contador (FOR UPDATE) e incrementa atómicamente.
  //    Cualquier otra venta del mismo tenant+año espera aquí hasta que
  //    esta transacción termine. Otros tenants NO se bloquean (fila distinta).
  const [rows] = await sequelize.query(
    `UPDATE ticket_counters
     SET last_number = last_number + 1, updated_at = NOW()
     WHERE tenant_id = :tenantId AND year = :year
     RETURNING last_number`,
    {
      replacements: { tenantId, year },
      transaction,
    }
  );

  const nextNumber = rows[0].last_number;
  const padded = String(nextNumber).padStart(PAD_LENGTH, '0');

  return `${year}-${padded}`;
}

module.exports = { generateTicketNumber };