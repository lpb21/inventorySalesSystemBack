const { DataTypes } = require('sequelize');

/**
 * El SMS al cliente ahora lo dispara el tendero desde un botón (fiado o abono).
 * sms_logs guarda a qué venta/abono corresponde y los índices únicos parciales
 * impiden que un doble clic envíe (y cobre) dos veces el mismo aviso.
 * Un envío fallido no bloquea: se puede reintentar.
 *
 * Idempotente: en tests, sync({ force:true }) ya crea las columnas desde el modelo.
 */
module.exports = {
  async up(queryInterface) {
    const table = await queryInterface.describeTable('sms_logs');
    if (!table.sale_id) {
      await queryInterface.addColumn('sms_logs', 'sale_id', {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'sales', key: 'id' },
        onDelete: 'SET NULL',
      });
    }
    if (!table.customer_payment_id) {
      await queryInterface.addColumn('sms_logs', 'customer_payment_id', {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'customer_payments', key: 'id' },
        onDelete: 'SET NULL',
      });
    }

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS sms_logs_sale_once
        ON sms_logs (sale_id)
        WHERE sale_id IS NOT NULL AND status IN ('pending', 'sent');
    `);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS sms_logs_payment_once
        ON sms_logs (customer_payment_id)
        WHERE customer_payment_id IS NOT NULL AND status IN ('pending', 'sent');
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS sms_logs_payment_once;');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS sms_logs_sale_once;');
    const table = await queryInterface.describeTable('sms_logs');
    if (table.customer_payment_id) await queryInterface.removeColumn('sms_logs', 'customer_payment_id');
    if (table.sale_id) await queryInterface.removeColumn('sms_logs', 'sale_id');
  },
};
