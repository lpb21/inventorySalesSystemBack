const { DataTypes } = require('sequelize');

/**
 * Créditos SMS prepago por tenant:
 * - tenants.sms_enabled / tenants.sms_balance (saldo actual, nunca negativo)
 * - sms_credit_transactions: libro de movimientos (bono, compra, consumo, ajuste)
 * - sms_logs: un registro por intento de envío (enviado / fallido / omitido)
 * - sms_balance_checks: resultado del job que compara créditos vs saldo Twilio
 *
 * Idempotente: en tests, sync({ force:true }) ya crea todo desde los modelos.
 */
module.exports = {
  async up(queryInterface) {
    const tenants = await queryInterface.describeTable('tenants');
    if (!tenants.sms_enabled) {
      await queryInterface.addColumn('tenants', 'sms_enabled', {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }
    if (!tenants.sms_balance) {
      await queryInterface.addColumn('tenants', 'sms_balance', {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      });
    }
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenants_sms_balance_non_negative') THEN
          ALTER TABLE tenants ADD CONSTRAINT tenants_sms_balance_non_negative CHECK (sms_balance >= 0);
        END IF;
      END $$;
    `);

    await queryInterface.createTable('sms_credit_transactions', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      tenant_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      // welcome_bonus | purchase | consumption | adjustment
      type: { type: DataTypes.STRING(30), allowNull: false },
      amount: { type: DataTypes.INTEGER, allowNull: false }, // + acredita, - descuenta
      balance_after: { type: DataTypes.INTEGER, allowNull: false },
      package_code: { type: DataTypes.STRING(30), allowNull: true },
      price_cop: { type: DataTypes.INTEGER, allowNull: true },
      note: { type: DataTypes.TEXT, allowNull: true },
      sms_log_id: { type: DataTypes.UUID, allowNull: true },
      created_by: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'SET NULL',
      },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });

    await queryInterface.createTable('sms_logs', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      tenant_id: {
        type: DataTypes.UUID,
        allowNull: true, // null = alerta interna a superadmins
        references: { model: 'tenants', key: 'id' },
        onDelete: 'CASCADE',
      },
      customer_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: { model: 'customers', key: 'id' },
        onDelete: 'SET NULL',
      },
      // credit_charge | credit_payment | admin_alert
      kind: { type: DataTypes.STRING(30), allowNull: false },
      // sent | failed | skipped
      status: { type: DataTypes.STRING(20), allowNull: false },
      skip_reason: { type: DataTypes.STRING(30), allowNull: true },
      to_masked: { type: DataTypes.STRING(20), allowNull: true },
      provider_sid: { type: DataTypes.STRING(64), allowNull: true },
      segments: { type: DataTypes.INTEGER, allowNull: true },
      error_code: { type: DataTypes.INTEGER, allowNull: true },
      error_message: { type: DataTypes.TEXT, allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });

    await queryInterface.createTable('sms_balance_checks', {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      provider_balance: { type: DataTypes.DECIMAL(12, 4), allowNull: true },
      provider_currency: { type: DataTypes.STRING(10), allowNull: true },
      committed_credits: { type: DataTypes.INTEGER, allowNull: false },
      committed_cost: { type: DataTypes.DECIMAL(12, 4), allowNull: false },
      // ok | warning | critical | error
      status: { type: DataTypes.STRING(20), allowNull: false },
      error_message: { type: DataTypes.TEXT, allowNull: true },
      alert_sent: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    });

    await queryInterface.sequelize.query(
      'CREATE INDEX IF NOT EXISTS sms_credit_transactions_tenant_created ON sms_credit_transactions (tenant_id, created_at);'
    );
    await queryInterface.sequelize.query(
      'CREATE INDEX IF NOT EXISTS sms_logs_tenant_created ON sms_logs (tenant_id, created_at);'
    );
    await queryInterface.sequelize.query(
      'CREATE INDEX IF NOT EXISTS sms_balance_checks_created ON sms_balance_checks (created_at);'
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('sms_balance_checks');
    await queryInterface.dropTable('sms_logs');
    await queryInterface.dropTable('sms_credit_transactions');
    await queryInterface.sequelize.query(
      'ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_sms_balance_non_negative;'
    );
    const tenants = await queryInterface.describeTable('tenants');
    if (tenants.sms_balance) await queryInterface.removeColumn('tenants', 'sms_balance');
    if (tenants.sms_enabled) await queryInterface.removeColumn('tenants', 'sms_enabled');
  },
};
