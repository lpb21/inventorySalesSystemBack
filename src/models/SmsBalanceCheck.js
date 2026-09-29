/**
 * SmsBalanceCheck Model
 * Resultado de cada corrida del job que compara los créditos SMS vendidos
 * (pendientes por consumir) contra el saldo real de la cuenta del proveedor.
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SmsBalanceCheck = sequelize.define('SmsBalanceCheck', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  provider_balance: {
    type: DataTypes.DECIMAL(12, 4),
    allowNull: true,
    field: 'provider_balance',
  },
  provider_currency: {
    type: DataTypes.STRING(10),
    allowNull: true,
    field: 'provider_currency',
  },
  committed_credits: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'committed_credits',
  },
  committed_cost: {
    type: DataTypes.DECIMAL(12, 4),
    allowNull: false,
    field: 'committed_cost',
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: { isIn: [['ok', 'warning', 'critical', 'error']] },
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'error_message',
  },
  alert_sent: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'alert_sent',
  },
}, {
  tableName: 'sms_balance_checks',
  underscored: true,
});

module.exports = SmsBalanceCheck;
