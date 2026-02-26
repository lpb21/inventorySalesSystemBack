/**
 * User Model
 * Represents users within a tenant
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tenant_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'tenants',
      key: 'id',
    },
    field: 'tenant_id',
    validate: {
      isUUID: 4,
    },
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      isEmail: true,
    },
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'password_hash',
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  role: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'cashier',
    values: ['owner', 'admin', 'supervisor', 'cashier', 'viewer', 'superadmin'],
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active',
  },
  is_superadmin: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_superadmin',
  },
  last_login: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_login',
  },
}, {
  tableName: 'users',
  indexes: [
    {
      fields: ['tenant_id', 'email'],
      unique: true,
    },
  ],
  hooks: {
    beforeCreate: async (user) => {
      // Only hash if the password is not already hashed (plain text)
      if (user.password_hash && !user.password_hash.startsWith('$2')) {
        user.password_hash = await bcrypt.hash(user.password_hash, 12);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password_hash')) {
        // Only hash if it's not already hashed
        if (!user.password_hash.startsWith('$2')) {
          user.password_hash = await bcrypt.hash(user.password_hash, 12);
        }
      }
    },
  },
});

// Instance method to validate password
User.prototype.validatePassword = async function(password) {
  return bcrypt.compare(password, this.password_hash);
};

// Instance method to exclude sensitive fields
User.prototype.toJSON = function() {
  const values = Object.assign({}, this.get());
  delete values.password_hash;
  return values;
};

module.exports = User;
