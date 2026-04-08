/**
 * Tenant Model
 * Represents a company/salsamentaría in the multi-tenant system
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Tenant = sequelize.define('Tenant', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  slug: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
    validate: {
      isAlphanumeric: true,
    },
  },
  business_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'business_name',
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      isEmail: true,
    },
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  phone: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  plan: {
    type: DataTypes.STRING(50),
    defaultValue: 'free',
    values: ['free', 'basic', 'pro', 'enterprise'],
  },
  subscription_status: {
    type: DataTypes.STRING(50),
    defaultValue: 'trial',
    values: ['trial', 'active', 'past_due', 'cancelled', 'suspended'],
    field: 'subscription_status',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  },
}, {
  tableName: 'tenants',
  indexes: [
    {
      fields: ['slug'],
    },
  ],
});

module.exports = Tenant;
