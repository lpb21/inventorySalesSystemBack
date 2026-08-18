require('../src/models'); // registra todos los modelos en la instancia de sequelize
const { sequelize } = require('../src/config/database');

beforeAll(async () => {
  await sequelize.authenticate();
  await sequelize.sync({ force: true }); // crea el esquema en la BD de prueba
});

afterAll(async () => {
  await sequelize.close();
});

test('conecta al Postgres de prueba y sincroniza el esquema', async () => {
  const [rows] = await sequelize.query('SELECT 1 AS ok');
  expect(Number(rows[0].ok)).toBe(1);
});