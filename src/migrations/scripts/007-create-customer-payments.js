const { DataTypes } = require('sequelize');

module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('customer_payments', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      tenant_id: { type: DataTypes.UUID, allowNull: false },
      customer_id: { type: DataTypes.UUID, allowNull: false, references: { model: 'customers', key: 'id' } },
      amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      previous_balance: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      new_balance: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
      note: { type: DataTypes.TEXT, allowNull: true },
      created_by: { type: DataTypes.UUID, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });
    await queryInterface.addIndex('customer_payments', ['tenant_id', 'customer_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('customer_payments');
  },
};