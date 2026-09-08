module.exports = {
  // Agrega la nota de cierre del turno. Se usa para registrar el motivo
  // cuando la caja cierra con descuadre (obligatoria en faltante desde el front).
  // Idempotente: en tests, sync({ force:true }) ya crea la columna desde el modelo,
  // así que solo la agregamos si no existe.
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('cash_registers');
    if (!table.closing_notes) {
      await queryInterface.addColumn('cash_registers', 'closing_notes', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('cash_registers');
    if (table.closing_notes) {
      await queryInterface.removeColumn('cash_registers', 'closing_notes');
    }
  },
};