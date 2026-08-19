const { sequelize } = require('../src/models');
const umzug = require('../src/migrations/umzug');

// Reconstruye el esquema desde cero y aplica las migraciones (constraints incluidos)
async function resetDb() {
  await sequelize.sync({ force: true });                          // tablas de los modelos
  await sequelize.query('DROP TABLE IF EXISTS "SequelizeMeta";'); // que umzug reaplique todo
  await umzug.up();                                               // migraciones (el CHECK de tipos)
}

module.exports = { resetDb, sequelize };