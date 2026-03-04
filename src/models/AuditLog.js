/**
 * AuditLog Model
 * Tracks all changes and actions in the system
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: true, // Can be null for superadmin actions
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
  entity_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'entity_type',
    comment: 'Product, User, Customer, Sale, Category, etc.',
  },
  entity_id: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'entity_id',
  },
  action: {
    type: DataTypes.STRING(20),
    allowNull: false,
    values: ['create', 'update', 'delete', 'login', 'logout', 'price_change', 'cost_change', 'stock_adjustment'],
  },
  changes: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'changes',
    comment: 'Stores the old and new values',
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  ip_address: {
    type: DataTypes.STRING(45),
    allowNull: true,
    field: 'ip_address',
  },
  user_agent: {
    type: DataTypes.STRING(255),
    allowNull: true,
    field: 'user_agent',
  },
}, {
  tableName: 'audit_logs',
  indexes: [
    {
      fields: ['tenant_id', 'created_at'],
    },
    {
      fields: ['entity_type', 'entity_id'],
    },
    {
      fields: ['tenant_id', 'action'],
    },
    {
      fields: ['user_id', 'created_at'],
    },
  ],
});

module.exports = AuditLog;

