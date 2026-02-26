/**
 * Make tenant_id nullable script
 */
const { sequelize } = require('../models');

async function makeTenantNullable() {
  try {
    console.log('🔧 Haciendo tenant_id nullable...');
    await sequelize.query('ALTER TABLE users ALTER COLUMN tenant_id DROP NOT NULL;');
    console.log('✅ ¡Columna tenant_id ahora es nullable!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

makeTenantNullable();
