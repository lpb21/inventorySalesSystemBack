/**
 * PurchaseOrder Model
 * Represents purchase orders within a tenant (optional)
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PurchaseOrder = sequelize.define('PurchaseOrder', {
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
  supplier_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'suppliers',
      key: 'id',
    },
    field: 'supplier_id',
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
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'pending',
    values: ['pending', 'received', 'cancelled'],
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  subtotal: {
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
    defaultValue: 0,
  },
  order_date: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'order_date',
  },
  expected_date: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'expected_date',
  },
  received_date: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'received_date',
  },
}, {
  tableName: 'purchase_orders',
  indexes: [
    {
      fields: ['tenant_id'],
    },
    {
      fields: ['tenant_id', 'status'],
    },
  ],
});

module.exports = PurchaseOrder;
