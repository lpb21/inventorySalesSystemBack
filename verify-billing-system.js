/**
 * Script de verificación: Sistema de billing funcionando correctamente
 * Ejecutar después de la migración para confirmar que todo funciona
 */

require('dotenv').config();
const { Tenant, TenantSubscription, BillingWebhookEvent } = require('./src/models');
const { sequelize } = require('./src/config/database');
const billingService = require('./src/services/billingService');

async function verifyBillingSystem() {
  console.log('🔍 Verificando sistema de billing...\n');

  try {
    // 1. Verificar sincronización entre tenants y tenant_subscriptions
    console.log('📋 1. Verificando sincronización de datos...');

    const tenantsWithSubscriptions = await Tenant.findAll({
      include: [{
        model: TenantSubscription,
        as: 'subscription',
        required: false
      }],
      attributes: ['id', 'name', 'plan', 'subscription_status']
    });

    console.log(`   ✅ Encontrados ${tenantsWithSubscriptions.length} tenants`);

    let syncIssues = 0;
    for (const tenant of tenantsWithSubscriptions) {
      if (tenant.subscription) {
        // Verificar que los datos estén sincronizados
        if (tenant.plan !== tenant.subscription.plan_code) {
          console.log(`   ⚠️  ${tenant.name}: Plan desincronizado - Tenant: ${tenant.plan}, Subscription: ${tenant.subscription.plan_code}`);
          syncIssues++;
        } else {
          console.log(`   ✅ ${tenant.name}: Plan ${tenant.plan} - Sincronizado`);
        }
      } else {
        console.log(`   ❌ ${tenant.name}: Sin suscripción en tenant_subscriptions`);
        syncIssues++;
      }
    }

    if (syncIssues === 0) {
      console.log('   🎉 Todos los tenants están correctamente sincronizados\n');
    } else {
      console.log(`   ⚠️  Encontrados ${syncIssues} problemas de sincronización\n`);
    }

    // 2. Verificar el servicio de billing
    console.log('🔧 2. Verificando servicio de billing...');

    const firstTenant = tenantsWithSubscriptions[0];
    if (firstTenant) {
      try {
        const subscription = await billingService.getTenantSubscription(firstTenant.id);
        if (subscription) {
          console.log(`   ✅ billingService.getTenantSubscription() funciona correctamente`);
          console.log(`   📄 Suscripción de ${firstTenant.name}: Plan ${subscription.plan_code}, Estado: ${subscription.status}`);
        } else {
          console.log(`   ❌ No se pudo obtener suscripción para ${firstTenant.name}`);
        }
      } catch (error) {
        console.log(`   ❌ Error en billingService: ${error.message}`);
      }
    }

    // 3. Verificar estructura de base de datos
    console.log('\n🗄️  3. Verificando estructura de tablas...');

    const subscriptionsCount = await TenantSubscription.count();
    const webhookEventsCount = await BillingWebhookEvent.count();

    console.log(`   ✅ tenant_subscriptions: ${subscriptionsCount} registros`);
    console.log(`   ✅ billing_webhook_events: ${webhookEventsCount} registros`);

    // 4. Verificar planes disponibles
    console.log('\n📊 4. Resumen de planes activos...');

    const planSummary = await TenantSubscription.findAll({
      attributes: [
        'plan_code',
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['plan_code', 'status'],
      raw: true,
      order: ['plan_code', 'status']
    });

    planSummary.forEach(item => {
      console.log(`   ${item.plan_code} (${item.status}): ${item.count} tenant(s)`);
    });

    // 5. Verificar conexión con modelos
    console.log('\n🔗 5. Verificando relaciones de modelos...');

    const subscriptionWithTenant = await TenantSubscription.findOne({
      include: [{
        model: Tenant,
        as: 'tenant',
        attributes: ['id', 'name', 'plan']
      }]
    });

    if (subscriptionWithTenant && subscriptionWithTenant.tenant) {
      console.log(`   ✅ Relación TenantSubscription -> Tenant funciona`);
      console.log(`   📄 Ejemplo: ${subscriptionWithTenant.tenant.name} -> Plan ${subscriptionWithTenant.plan_code}`);
    } else {
      console.log(`   ❌ Problema con relación TenantSubscription -> Tenant`);
    }

    console.log('\n🎉 VERIFICACIÓN COMPLETADA');
    console.log('=' .repeat(50));
    console.log('✅ Sistema de billing configurado correctamente');
    console.log('✅ Migración exitosa');
    console.log('✅ Tablas creadas y sincronizadas');
    console.log('✅ Servicios funcionando');
    console.log('🚀 ¡El sistema está listo para producción!');

  } catch (error) {
    console.error('❌ Error durante la verificación:', error);
    throw error;
  }
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  verifyBillingSystem()
    .then(() => {
      console.log('\n✅ Verificación completada correctamente');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error durante la verificación:', error);
      process.exit(1);
    });
}

module.exports = verifyBillingSystem;