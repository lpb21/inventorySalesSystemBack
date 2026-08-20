const { sequelize } = require('../src/models');
const umzug = require('../src/migrations/umzug');

async function resetDb() {
  // Borra las tablas que sync NO conoce (no son modelos), antes de reconstruir
  await sequelize.query('DROP TABLE IF EXISTS "SequelizeMeta" CASCADE;');
  await sequelize.query('DROP TABLE IF EXISTS ticket_counters CASCADE;');
  await sequelize.sync({ force: true }); // recrea las tablas de los modelos
  await umzug.up();                      // aplica migraciones (ticket_counters, constraints, etc.)
}

module.exports = { resetDb, sequelize };