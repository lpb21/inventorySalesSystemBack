/**
 * Fix Password Script
 * Actualiza la contraseña del usuario
 */
const bcrypt = require('bcryptjs');
const { sequelize, User, Tenant } = require('../models');

async function fixPassword() {
  try {
    console.log('🔧 Corrigiendo contraseña...\n');
    
    const email = 'admin@mi-salsamentaria.com';
    const newPassword = 'admin123';
    
    // Buscar usuario
    const user = await User.findOne({
      where: { email },
    });
    
    if (!user) {
      console.log('❌ Usuario no encontrado');
      process.exit(1);
    }
    
    // Generar nuevo hash
    const newHash = await bcrypt.hash(newPassword, 12);
    
    // Actualizar contraseña
    await user.update({ password_hash: newHash });
    
    console.log('✓ Contraseña actualizada para:', email);
    console.log('  Nuevo hash:', newHash);
    console.log('\n✅ Ahora puedes iniciar sesión con:');
    console.log('   Email:', email);
    console.log('   Contraseña:', newPassword);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixPassword();
