module.exports = {
  async up(queryInterface, Sequelize) {
    // --- Tabla 1: recipes (la cabecera de cada receta de despiece) ---
    await queryInterface.createTable('recipes', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      tenant_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      source_product_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'products', key: 'id' },
        onDelete: 'CASCADE',
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // --- Tabla 2: recipe_items (los destinos sugeridos de cada receta) ---
    await queryInterface.createTable('recipe_items', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      recipe_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'recipes', key: 'id' },
        onDelete: 'CASCADE',  // si se borra la receta, se borran sus items
      },
      product_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'products', key: 'id' },
        onDelete: 'CASCADE',
      },
      quantity: {
        type: Sequelize.DECIMAL(12, 3),  // misma precisión que stock
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Índice para buscar rápido los items de una receta
    await queryInterface.addIndex('recipe_items', ['recipe_id']);
  },

  async down(queryInterface) {
    // Orden inverso: primero items (por la FK), luego recipes
    await queryInterface.dropTable('recipe_items');
    await queryInterface.dropTable('recipes');
  },
};