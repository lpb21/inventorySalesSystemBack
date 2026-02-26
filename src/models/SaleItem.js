/**
 * SaleItem Model
 * Represents individual items in a sale
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SaleItem = sequelize.define('SaleItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  sale_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'sales',
      key: 'id',
    },
    field: 'sale_id',
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
  quantity: {
    type: DataTypes.DECIMAL(12, 3),
    allowNull: false,
  },
  unit_price: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    field: 'unit_price',
  },
  unit_cost: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'unit_cost',
  },
  subtotal: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    field: 'subtotal',
  },
}, {
  tableName: 'sale_items',
  indexes: [
    {
      fields: ['sale_id'],
    },
    {
      fields: ['tenant_id', 'product_id'],
    },
  ],
});

module.exports = SaleItem;
