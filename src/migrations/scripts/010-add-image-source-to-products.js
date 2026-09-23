const { DataTypes } = require('sequelize');

module.exports = {
  // Idempotente: en tests, sync({ force:true }) ya crea las columnas desde el modelo,
  // así que solo las agregamos si no existen.
  async up(queryInterface) {
    const table = await queryInterface.describeTable('products');

    if (!table.image_source) {
      await queryInterface.addColumn('products', 'image_source', {
        type: DataTypes.STRING(20),
        allowNull: true,
      });
    }

    if (!table.image_source_ref) {
      await queryInterface.addColumn('products', 'image_source_ref', {
        type: DataTypes.TEXT,
        allowNull: true,
      });
    }

    // CHECK de valores permitidos (idempotente)
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'products_image_source_check'
        ) THEN
          ALTER TABLE products
            ADD CONSTRAINT products_image_source_check
            CHECK (image_source IS NULL OR image_source IN ('user', 'off', 'generic', 'none'));
        END IF;
      END $$;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE products DROP CONSTRAINT IF EXISTS products_image_source_check;'
    );

    const table = await queryInterface.describeTable('products');
    if (table.image_source_ref) {
      await queryInterface.removeColumn('products', 'image_source_ref');
    }
    if (table.image_source) {
      await queryInterface.removeColumn('products', 'image_source');
    }
  },
};
