/**
 * InventoryMovement Model
 * Tracks all inventory changes within a tenant
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InventoryMovement = sequelize.define('InventoryMovement', {
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
  product_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'products',
      key: 'id',
    },
    field: 'product_id',
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
  type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    values: ['sale', 'purchase', 'adjustment', 'waste', 'return', 'transfer'],
  },
  quantity: {
    type: DataTypes.DECIMAL(12, 3),
    allowNull: false,
  },
  stock_before: {
    type: DataTypes.DECIMAL(12, 3),
    allowNull: false,
    field: 'stock_before',
  },
  stock_after: {
    type: DataTypes.DECIMAL(12, 3),
    allowNull: false,
    field: 'stock_after',
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  reference_id: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'reference_id',
  },
}, {
  tableName: 'inventory_movements',
  indexes: [
    {
      fields: ['tenant_id', 'product_id'],
    },
    {
      fields: ['tenant_id', 'created_at'],
    },
    {
      fields: ['tenant_id', 'type'],
    },
  ],
});

module.exports = InventoryMovement;
