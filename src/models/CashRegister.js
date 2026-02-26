/**
 * CashRegister Model
 * Represents cash registers within a tenant
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CashRegister = sequelize.define('CashRegister', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'tenants',
      key: 'id',
    },
    field: 'tenant_id',
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id',
    },
    field: 'user_id',
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  opening_amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'opening_amount',
  },
  closing_amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    field: 'closing_amount',
  },
  expected_amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
    field: 'expected_amount',
  },
  cash_in_drawer: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'cash_in_drawer',
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'closed',
    values: ['open', 'closed'],
  },
  opened_at: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'opened_at',
  },
  closed_at: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'closed_at',
  },
}, {
  tableName: 'cash_registers',
  indexes: [
    {
      fields: ['tenant_id'],
    },
    {
      fields: ['tenant_id', 'status'],
    },
  ],
});

module.exports = CashRegister;
