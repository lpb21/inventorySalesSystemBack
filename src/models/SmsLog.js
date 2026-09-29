/**
 * SmsLog Model
 * Un registro por intento de envío de SMS (enviado, fallido u omitido).
 * Columnas sale_id / customer_payment_id: migración 011.
 * tenant_id null = alerta interna a superadmins.
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SmsLog = sequelize.define('SmsLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'tenants', key: 'id' },
    field: 'tenant_id',
  },
  customer_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'customers', key: 'id' },
    field: 'customer_id',
  },
  // A qué fiado / abono corresponde el aviso (evita enviarlo dos veces).
  sale_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'sales', key: 'id' },
    field: 'sale_id',
  },
  customer_payment_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'customer_payments', key: 'id' },
    field: 'customer_payment_id',
  },
  kind: {
    type: DataTypes.STRING(30),
    allowNull: false,
    validate: { isIn: [['credit_charge', 'credit_payment', 'admin_alert']] },
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    // pending: reservado mientras se envía (lo usa el índice anti doble envío)
    validate: { isIn: [['pending', 'sent', 'failed', 'skipped']] },
  },
  skip_reason: {
    type: DataTypes.STRING(30),
    allowNull: true,
    field: 'skip_reason',
  },
  to_masked: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'to_masked',
  },
  provider_sid: {
    type: DataTypes.STRING(64),
    allowNull: true,
    field: 'provider_sid',
  },
  segments: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  error_code: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'error_code',
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'error_message',
  },
}, {
  tableName: 'sms_logs',
  underscored: true,
});

module.exports = SmsLog;
