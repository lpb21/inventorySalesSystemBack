const { DataTypes } = require('sequelize');

module.exports = {
  // Idempotente: en tests, sync({ force:true }) ya crea la columna desde el modelo,
  // así que solo la agregamos si no existe.
  async up(queryInterface) {
    const table = await queryInterface.describeTable('customers');
    if (!table.whatsapp_notifications_enabled) {
      await queryInterface.addColumn('customers', 'whatsapp_notifications_enabled', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('customers');
    if (table.whatsapp_notifications_enabled) {
      await queryInterface.removeColumn('customers', 'whatsapp_notifications_enabled');
    }
  },
};
