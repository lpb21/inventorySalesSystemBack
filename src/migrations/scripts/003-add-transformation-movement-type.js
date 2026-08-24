const VALID_TYPES = ['sale', 'purchase', 'adjustment', 'waste', 'return', 'transfer', 'transformation'];

module.exports = {
  async up(queryInterface) {
    const list = VALID_TYPES.map((t) => `'${t}'`).join(', ');
    await queryInterface.sequelize.query(
      'ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_type_check;'
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_type_check CHECK (type IN (${list}));`
    );
  },

  async down(queryInterface) {
    // Revertir a la lista sin 'transformation'
    const previous = ['sale', 'purchase', 'adjustment', 'waste', 'return', 'transfer'];
    const list = previous.map((t) => `'${t}'`).join(', ');
    await queryInterface.sequelize.query(
      'ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_type_check;'
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE inventory_movements ADD CONSTRAINT inventory_movements_type_check CHECK (type IN (${list}));`
    );
  },
};