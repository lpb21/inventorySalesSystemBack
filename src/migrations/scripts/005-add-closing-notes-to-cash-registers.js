module.exports = {
  // Agrega la nota de cierre del turno. Se usa para registrar el motivo
  // cuando la caja cierra con descuadre (obligatoria en faltante desde el front).
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('cash_registers', 'closing_notes', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('cash_registers', 'closing_notes');
  },
};