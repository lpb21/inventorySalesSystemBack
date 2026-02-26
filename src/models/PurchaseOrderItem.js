/**
 * PurchaseOrderItem Model
 * Represents items in a purchase order
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PurchaseOrderItem = sequelize.define('PurchaseOrderItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  purchase_order_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'purchase_orders',
      key: 'id',
    },
    field: 'purchase_order_id',
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
  quantity: {
    type: DataTypes.DECIMAL(12, 3),
    allowNull: false,
  },
  unit_cost: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'unit_cost',
  },
  quantity_received: {
    type: DataTypes.DECIMAL(12, 3),
    allowNull: false,
    defaultValue: 0,
    field: 'quantity_received',
  },
  subtotal: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    field: 'subtotal',
  },
}, {
  tableName: 'purchase_order_items',
  indexes: [
    {
      fields: ['purchase_order_id'],
    },
    {
      fields: ['product_id'],
    },
  ],
});

module.exports = PurchaseOrderItem;
