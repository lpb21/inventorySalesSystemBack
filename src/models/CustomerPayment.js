/**
 * CustomerPayment Model
 * Registro histórico de abonos de un cliente a su saldo de crédito.
 * Tabla creada por la migración 007-create-customer-payments.
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CustomerPayment = sequelize.define('CustomerPayment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'tenant_id',
  },
  customer_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'customers',
      key: 'id',
    },
    field: 'customer_id',
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  previous_balance: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    field: 'previous_balance',
  },
  new_balance: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    field: 'new_balance',
  },
  note: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'created_by',
  },
}, {
  tableName: 'customer_payments',
  underscored: true,
  // La tabla solo tiene created_at (los abonos no se editan)
  updatedAt: false,
  // Sin `indexes` aquí: el índice (tenant_id, customer_id) lo crea la migración 007;
  // declararlo también en el modelo haría chocar sync + migración en los tests.
});

module.exports = CustomerPayment;
