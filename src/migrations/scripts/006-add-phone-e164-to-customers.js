const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    await queryInterface.addColumn('customers', 'phone_country', {
      type: DataTypes.STRING(2),
      allowNull: false,
      defaultValue: 'CO',
    });
    await queryInterface.addColumn('customers', 'phone_e164', {
      type: DataTypes.STRING(20),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('customers', 'phone_e164');
    await queryInterface.removeColumn('customers', 'phone_country');
  },
};