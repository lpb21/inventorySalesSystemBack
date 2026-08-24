/**
 * Fix Superadmin Tenant Script
 * Ensures superadmin has NULL tenant_id (should not belong to any business tenant)
 */
const { sequelize, Tenant, User } = require('../models');

async function fixSuperadminTenant() {
  try {
    console.log('🔧 Iniciando corrección de tenant del superadmin...');
    
    // Find superadmin user
    const superadmin = await User.findOne({ 
      where: { email: 'dev@global-admin.com' } 
    });
    
    if (!superadmin) {
      console.log('❌ No se encontró el usuario superadmin');
      process.exit(1);
    }
    
    console.log('✓ Usuario superadmin encontrado:', superadmin.email);
    console.log('  - Tenant actual:', superadmin.tenant_id || 'NULL');
    console.log('  - Nuevo tenant: NULL (el superadmin no debe pertenecer a ningún tenant)');
    
    // Update superadmin tenant_id to NULL
    await User.update(
      { tenant_id: null },
      { where: { email: 'dev@global-admin.com' } }
    );
    
    console.log('\n✅ ¡Superadmin actualizado correctamente!');
    console.log('   El superadmin ya no pertenece a ningún tenant de negocio');
    
    // Verify
    const updatedSuperadmin = await User.findOne({ 
      where: { email: 'dev@global-admin.com' } 
    });
    console.log('   - Tenant_id actual:', updatedSuperadmin.tenant_id || 'NULL');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

module.exports = fixSuperadminTenant;

// Run if executed directly
if (require.main === module) {
  fixSuperadminTenant();
}
