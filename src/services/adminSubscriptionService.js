/**
 * Admin Subscription Service
 * Activación/renovación manual de suscripciones por un superadmin.
 * Actualiza tenant_subscriptions Y tenants.subscription_status (mantiene sincronizadas
 * las dos fuentes), y deja rastro en audit_logs.
 */
const { sequelize, Tenant, TenantSubscription } = require('../models');
const { getPeriodConfig, calculatePeriodEnd } = require('../utils/subscriptionDates');
const { NotFoundError, ValidationError } = require('../utils/errors');
const tenantMiddleware = require('../middlewares/tenantMiddleware');
const auditService = require('./auditService');

class AdminSubscriptionService {
  /**
   * Activa o renueva la suscripción de un tenant.
   * @param {string} tenantId - tenant objetivo
   * @param {string} period - 'trial' | 'monthly' | 'quarterly' | 'yearly'
   * @param {string} actorUserId - el superadmin que ejecuta la acción (para auditoría)
   */
  async activate(tenantId, period, actorUserId) {
    const config = getPeriodConfig(period);
    if (!config) {
      throw new ValidationError(
        `Periodo inválido: "${period}". Debe ser trial, monthly, quarterly o yearly.`
      );
    }

    const now = new Date();
    const periodEnd = calculatePeriodEnd(config.days, now);

    const result = await sequelize.transaction(async (transaction) => {
      // 1) El tenant debe existir
      const tenant = await Tenant.findByPk(tenantId, { transaction });
      if (!tenant) {
        throw new NotFoundError('Tenant no encontrado');
      }

      // 2) Actualiza (o crea) la fila de tenant_subscriptions
      const [subscription] = await TenantSubscription.findOrCreate({
        where: { tenant_id: tenantId },
        defaults: {
          tenant_id: tenantId,
          provider: 'manual',
          plan_code: period,
          status: config.status,
          current_period_start: now,
          current_period_end: periodEnd,
        },
        transaction,
      });

      // Si ya existía, la renovamos (periodo siempre desde ahora)
      await subscription.update({
        status: config.status,
        plan_code: period,
        current_period_start: now,
        current_period_end: periodEnd,
        grace_until: null,            // al renovar, limpiamos cualquier gracia previa
        last_payment_at: now,
      }, { transaction });

      // 3) Sincroniza el estado simple del tenant (la otra fuente)
      await tenant.update({
        subscription_status: config.status,
        is_active: true,
      }, { transaction });

      return { tenant, subscription };
    });

    // Invalida la caché del tenant para que el cambio se refleje al instante
    // (sin esperar el TTL de 5 min de Redis)
    await tenantMiddleware.invalidateTenantCache(tenantId);

    // 4) Auditoría (fuera de la transacción; no debe tumbar la operación si falla)
    await auditService.log({
      tenantId,
      userId: actorUserId,
      entityType: 'subscription',
      entityId: tenantId,
      action: 'activate',
      description: `Suscripción activada manualmente: periodo=${period}, vence=${periodEnd.toISOString()}`,
    });

    return {
      tenant_id: tenantId,
      period,
      status: result.subscription.status,
      current_period_start: result.subscription.current_period_start,
      current_period_end: result.subscription.current_period_end,
    };
  }
}

module.exports = new AdminSubscriptionService();