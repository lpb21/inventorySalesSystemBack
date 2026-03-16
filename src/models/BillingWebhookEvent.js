/**
 * BillingWebhookEvent Model
 * Stores processed webhook events to guarantee idempotency.
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const BillingWebhookEvent = sequelize.define('BillingWebhookEvent', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  provider: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'wompi',
  },
  event_id: {
    type: DataTypes.STRING(120),
    allowNull: false,
    field: 'event_id',
  },
  event_type: {
    type: DataTypes.STRING(120),
    allowNull: false,
    field: 'event_type',
  },
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'tenant_id',
  },
  status: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'processed',
  },
  payload: {
    type: DataTypes.JSONB,
    allowNull: false,
  },
  processed_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'processed_at',
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'error_message',
  },
}, {
  tableName: 'billing_webhook_events',
  indexes: [
    {
      unique: true,
      fields: ['provider', 'event_id'],
    },
    { fields: ['tenant_id'] },
    { fields: ['processed_at'] },
  ],
});

module.exports = BillingWebhookEvent;
