/**
 * TenantSubscription Model
 * Stores subscription lifecycle per tenant independently from tenant profile.
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TenantSubscription = sequelize.define('TenantSubscription', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    field: 'tenant_id',
  },
  provider: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'epayco',
  },
  plan_code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: 'plan_code',
  },
  status: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'pending',
  },
  last_checkout_reference: {
    type: DataTypes.STRING(120),
    allowNull: true,
    field: 'last_checkout_reference',
  },
  external_customer_id: {
    type: DataTypes.STRING(120),
    allowNull: true,
    field: 'external_customer_id',
  },
  external_subscription_id: {
    type: DataTypes.STRING(120),
    allowNull: true,
    field: 'external_subscription_id',
  },
  current_period_start: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'current_period_start',
  },
  current_period_end: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'current_period_end',
  },
  grace_until: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'grace_until',
  },
  last_payment_at: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_payment_at',
  },
  last_payment_failed_at: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_payment_failed_at',
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    field: 'metadata',
  },
}, {
  tableName: 'tenant_subscriptions',
  indexes: [
    { fields: ['tenant_id'] },
    { fields: ['status'] },
    { fields: ['last_checkout_reference'] },
    { fields: ['provider'] },
  ],
});

module.exports = TenantSubscription;
