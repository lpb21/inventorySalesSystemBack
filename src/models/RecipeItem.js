/**
 * RecipeItem Model
 * Cada destino sugerido de una receta (producto + cantidad por unidad de origen)
 */
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RecipeItem = sequelize.define('RecipeItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  recipe_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  product_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  quantity: {
    type: DataTypes.DECIMAL(12, 3),
    allowNull: false,
    get() {
      const value = this.getDataValue('quantity');
      return value ? parseFloat(value) : 0;
    },
  },
}, {
  tableName: 'recipe_items',
  underscored: true,
  timestamps: true,
});

module.exports = RecipeItem;