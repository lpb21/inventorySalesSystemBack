/**
 * Supplier Model
 * Represents suppliers within a tenant (optional)
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Supplier = sequelize.define('Supplier', {
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
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  contact_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'contact_name',
  },
  document: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      isEmail: true,
    },
  },
  phone: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  },
}, {
  tableName: 'suppliers',
  indexes: [
    {
      fields: ['tenant_id'],
    },
  ],
});

module.exports = Supplier;
