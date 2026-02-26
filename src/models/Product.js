/**
 * Product Model
 * Represents products within a tenant
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Product = sequelize.define('Product', {
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
  category_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'categories',
      key: 'id',
    },
    field: 'category_id',
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
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  sku: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  barcode: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  price: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
  },
  cost: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
    field: 'cost',
  },
  stock: {
    type: DataTypes.DECIMAL(12, 3),
    allowNull: false,
    defaultValue: 0,
  },
  min_stock: {
    type: DataTypes.DECIMAL(12, 3),
    allowNull: false,
    defaultValue: 0,
    field: 'min_stock',
  },
  unit: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'und',
    values: ['kg', 'lb', 'und', 'paq', 'l', 'ml'],
  },
  type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'unit',
    values: ['weight', 'unit', 'portion'],
  },
  image_url: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'image_url',
  },
  expiry_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'expiry_date',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  },
}, {
  tableName: 'products',
  indexes: [
    {
      fields: ['tenant_id', 'category_id'],
    },
    {
      fields: ['tenant_id', 'barcode'],
    },
    {
      fields: ['tenant_id', 'sku'],
    },
    {
      fields: ['tenant_id', 'is_active'],
    },
  ],
});

module.exports = Product;
