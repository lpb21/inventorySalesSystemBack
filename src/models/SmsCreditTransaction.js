/**
 * SmsCreditTransaction Model
 * Libro de movimientos de créditos SMS de un tenant (bono, compra, consumo, ajuste).
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SmsCreditTransaction = sequelize.define('SmsCreditTransaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'tenants', key: 'id' },
    field: 'tenant_id',
  },
  type: {
    type: DataTypes.STRING(30),
    allowNull: false,
    validate: { isIn: [['welcome_bonus', 'purchase', 'consumption', 'adjustment']] },
  },
  amount: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  balance_after: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'balance_after',
  },
  package_code: {
    type: DataTypes.STRING(30),
    allowNull: true,
    field: 'package_code',
  },
  price_cop: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'price_cop',
  },
  note: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  sms_log_id: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'sms_log_id',
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
    field: 'created_by',
  },
}, {
  tableName: 'sms_credit_transactions',
  underscored: true,
});

module.exports = SmsCreditTransaction;
