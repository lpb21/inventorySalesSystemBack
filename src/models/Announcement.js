/**
 * Announcement Model
 * Global banner messages from superadmin, shown to all users on all tenants.
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Announcement = sequelize.define('Announcement', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active',
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'expires_at',
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id',
    },
    field: 'created_by',
  },
}, {
  tableName: 'announcements',
  underscored: true,
});

module.exports = Announcement;
