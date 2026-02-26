/**
 * Seed Superadmin Script
 * Creates a superadmin user for development
 */
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function seedSuperadmin() {
  const { sequelize, Tenant, User } = require('../models');
  
  try {
    console.log('🌱 Iniciando seed de superadmin...');
    
    // Create globaladmindev Tenant
    const tenant = await Tenant.findOne({ where: { slug: 'globaladmindev' } });
    let tenantId;
    
    if (!tenant) {
      const newTenant = await Tenant.create({
        id: uuidv4(),
        name: 'Global Admin Dev',
        slug: 'globaladmindev',
        business_name: 'Global Admin Development',
        address: 'Sistema Central',
        phone: '+57 300 000 0000',
        email: 'dev@global-admin.com',
        plan: 'enterprise',
        subscription_status: 'active',
        is_active: true
      });
      tenantId = newTenant.id;
      console.log('✓ Tenant creado:', newTenant.name);
    } else {
      tenantId = tenant.id;
      console.log('✓ Tenant ya existe:', tenant.name);
    }
    
    // Create Superadmin User
    const userExists = await User.findOne({ 
      where: { tenant_id: tenantId, role: 'superadmin' }
    });
    
    if (!userExists) {
      const passwordHash = await bcrypt.hash('dev123456', 12);
      await User.create({
        id: uuidv4(),
        tenant_id: tenantId,
        name: 'Desarrollador',
        email: 'dev@global-admin.com',
        password_hash: passwordHash,
        role: 'superadmin',
        is_active: true,
        is_superadmin: true
      });
      console.log('✓ Superadmin creado: dev@global-admin.com / dev123456');
    } else {
      console.log('✓ Superadmin ya existe');
    }
    
    console.log('\n🎉 Seed de superadmin completado!');
    console.log('\n📋 Datos de acceso superadmin:');
    console.log('   Email: dev@global-admin.com');
    console.log('   Contraseña: dev123456');
    console.log('   Tenant: globaladmindev');
    console.log('\n🌐 Puedes usar el header x-tenant-id para acceder a otros tenants');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error en seed superadmin:', error);
    process.exit(1);
  }
}

module.exports = seedSuperadmin;

// Run if executed directly
if (require.main === module) {
  seedSuperadmin();
}
