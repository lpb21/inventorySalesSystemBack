const { sequelize } = require('../src/models');
const umzug = require('../src/migrations/umzug');

async function resetDb() {
  // Borra TODO el esquema (incluye tablas que no son modelos, como ticket_counters y SequelizeMeta)
  await sequelize.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await sequelize.sync({ force: true }); // recrea las tablas de los modelos
  await umzug.up();                      // aplica migraciones (constraints, ticket_counters, etc.)
}

module.exports = { resetDb, sequelize };