/**
 * Fix Role Constraint Script
 * Adds superadmin role to users check constraint
 */
const { sequelize } = require('../models');

async function fixRoleConstraint() {
  try {
    console.log('🔧 Corrigiendo constraint de roles...');
    
    // Drop and recreate the constraint
    await sequelize.query(`
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    `);
    console.log('✓ Constraint anterior eliminado');
    
    await sequelize.query(`
      ALTER TABLE users ADD CONSTRAINT users_role_check 
      CHECK (role IN ('owner', 'admin', 'supervisor', 'cashier', 'viewer', 'superadmin'));
    `);
    console.log('✓ Nuevo constraint creado con superadmin');
    
    console.log('\n✅ Constraint de roles actualizado correctamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixRoleConstraint();
