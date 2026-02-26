/**
 * Sale Model
 * Represents sales transactions within a tenant
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Sale = sequelize.define('Sale', {
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
    allowNull: false,
    references: {
      model: 'users',
      key: 'id',
    },
    field: 'user_id',
  },
  customer_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'customers',
      key: 'id',
    },
    field: 'customer_id',
  },
  cash_register_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'cash_registers',
      key: 'id',
    },
    field: 'cash_register_id',
  },
  ticket_number: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'ticket_number',
  },
  customer_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'customer_name',
  },
  customer_document: {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'customer_document',
  },
  subtotal: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
  },
  discount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
  },
  tax: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
  },
  total: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  payment_method: {
    type: DataTypes.STRING(50),
    allowNull: false,
    values: ['cash', 'card', 'transfer', 'digital'],
    field: 'payment_method',
  },
  amount_received: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'amount_received',
  },
  change_given: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'change_given',
  },
  note: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'completed',
    values: ['completed', 'cancelled', 'refunded'],
  },
  cancelled_at: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'cancelled_at',
  },
  cancelled_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'cancelled_reason',
  },
}, {
  tableName: 'sales',
  indexes: [
    {
      fields: ['tenant_id', 'created_at'],
    },
    {
      fields: ['tenant_id', 'status'],
    },
    {
      fields: ['tenant_id', 'user_id'],
    },
  ],
});

module.exports = Sale;
