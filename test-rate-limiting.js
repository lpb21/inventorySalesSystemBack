/**
 * Rate Limiting Test Script
 * Para probar los límites de la API
 */

// Función para testear rate limits
function testRateLimit() {
  console.log('🧪 TEST DE RATE LIMITING');
  console.log('========================');
  
  // Test 1: Rate limit general
  console.log('\n1️⃣  Para probar límite GENERAL (100 requests/min):');
  console.log('   curl -i http://localhost:3000/health');
  console.log('   (repetir más de 100 veces rápidamente)');
  
  // Test 2: Rate limit de autenticación  
  console.log('\n2️⃣  Para probar límite de AUTENTICACIÓN (20/15min):');
  console.log('   curl -X POST http://localhost:3000/v1/auth/login \\');
  console.log('        -H "Content-Type: application/json" \\');
  console.log('        -d \'{"email": "test@test.com", "password": "wrong"}\'');
  console.log('   (repetir más de 20 veces)');
  
  // Test 3: Rate limit de reportes
  console.log('\n3️⃣  Para probar límite de REPORTES (10/min):');
  console.log('   curl -H "Authorization: Bearer YOUR_TOKEN" \\');
  console.log('        http://localhost:3000/v1/reports/dashboard');
  console.log('   (repetir más de 10 veces rápidamente)');
  
  // Test 4: Rate limit de escritura
  console.log('\n4️⃣  Para probar límite de ESCRITURA (50/min):');
  console.log('   curl -X POST http://localhost:3000/v1/products \\');
  console.log('        -H "Authorization: Bearer YOUR_TOKEN" \\');
  console.log('        -H "Content-Type: application/json" \\');
  console.log('        -d \'{"name": "Test", "price": 100}\'');
  console.log('   (repetir más de 50 veces)');
  
  console.log('\n📋 RESPUESTA ESPERADA AL EXCEDER LÍMITE:');
  console.log('   Status: 429 Too Many Requests');
  console.log('   Headers: RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset');
  console.log('   Body: {"success": false, "error": {"code": "RATE_LIMIT_EXCEEDED"}}');
  
  console.log('\n🔍 LOGS EN CONSOLA:');
  console.log('   🚫 [RATE LIMIT] Blocked request: { ip, method, url, userId... }');
}

module.exports = { testRateLimit };

// Si se ejecuta directamente
if (require.main === module) {
  testRateLimit();
}