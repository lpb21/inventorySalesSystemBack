/**
 * Test Login Script
 * Diagnostica problemas de autenticación
 */
const bcrypt = require('bcryptjs');
const { sequelize, User, Tenant } = require('../models');

async function testLogin() {
  try {
    console.log('🔍 Diagnóstico de login...\n');
    
    const email = 'admin@mi-salsamentaria.com';
    const password = 'admin123';
    
    // Buscar usuario
    const user = await User.findOne({
      where: { email },
      include: [{ model: Tenant, as: 'tenant' }],
    });
    
    if (!user) {
      console.log('❌ Usuario no encontrado');
      process.exit(1);
    }
    
    console.log('✓ Usuario encontrado:', user.email);
    console.log('  Nombre:', user.name);
    console.log('  Activo:', user.is_active);
    console.log('  Tenant:', user.tenant?.name);
    console.log('  Tenant activo:', user.tenant?.is_active);
    console.log('  Hash en BD:', user.password_hash.substring(0, 30) + '...');
    
    // Probar validación de contraseña
    console.log('\n🔐 Probando validación de contraseña...');
    const isValid = await user.validatePassword(password);
    console.log('  Resultado:', isValid ? '✓ Válida' : '❌ Inválida');
    
    // Probar bcrypt directamente
    console.log('\n🔄 Comparación directa con bcrypt:');
    const directCompare = await bcrypt.compare(password, user.password_hash);
    console.log('  Resultado:', directCompare ? '✓ Coincide' : '❌ No coincide');
    
    // Generar nuevo hash de la contraseña
    console.log('\n📝 Generando nuevo hash:');
    const newHash = await bcrypt.hash(password, 12);
    console.log('  Nuevo hash:', newHash.substring(0, 30) + '...');
    
    if (!isValid) {
      console.log('\n⚠️ La contraseña no coincide. ¿Deseas actualizar el hash en la base de datos?');
      console.log('   (Esto permitirá iniciar sesión con la contraseña actual)');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testLogin();
