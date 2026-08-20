module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ticket_counters', {
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
      year: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      last_number: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
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

    // Clave única: un solo contador por tenant y año (esto es clave para el aislamiento)
    await queryInterface.addConstraint('ticket_counters', {
      fields: ['tenant_id', 'year'],
      type: 'unique',
      name: 'ticket_counters_tenant_year_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ticket_counters');
  },
};