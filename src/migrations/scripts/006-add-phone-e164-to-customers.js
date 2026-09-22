const { DataTypes } = require('sequelize');

module.exports = {
  // Idempotente: en tests, sync({ force:true }) ya crea las columnas desde el modelo,
  // así que solo las agregamos si no existen.
  async up(queryInterface) {
    const table = await queryInterface.describeTable('customers');
    if (!table.phone_country) {
      await queryInterface.addColumn('customers', 'phone_country', {
        type: DataTypes.STRING(2),
        allowNull: false,
        defaultValue: 'CO',
      });
    }
    if (!table.phone_e164) {
      await queryInterface.addColumn('customers', 'phone_e164', {
        type: DataTypes.STRING(20),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('customers');
    if (table.phone_e164) {
      await queryInterface.removeColumn('customers', 'phone_e164');
    }
    if (table.phone_country) {
      await queryInterface.removeColumn('customers', 'phone_country');
    }
  },
};
