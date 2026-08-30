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
   * @param {string} reason - motivo opcional de la suspensión
   */

    /**
   * Lista todos los tenants con su estado de suscripción,
   * para el panel de administración.
   */
  async list() {
    const { User } = require('../models');
    const { Op } = require('sequelize');

        // Identificar los tenants que tienen un usuario superadmin (para excluirlos).
    const superadminUsers = await User.findAll({
      where: {
        [Op.or]: [
          { is_superadmin: true },
          { role: 'superadmin' },
        ],
      },
      attributes: ['tenant_id'],
    });
    const superadminTenantIds = superadminUsers
      .map(u => u.tenant_id)
      .filter(Boolean);

    const tenants = await Tenant.findAll({
      where: {
        [Op.and]: [
          // Excluir tenants atados a un usuario superadmin (si los hubiera)
          superadminTenantIds.length > 0
            ? { id: { [Op.notIn]: superadminTenantIds } }
            : {},
          // Excluir el tenant global de administración (superadmin sin tenant real)
          { email: { [Op.or]: [{ [Op.notILike]: '%global-admin%' }, { [Op.is]: null }] } },
          { name: { [Op.notILike]: '%Global Admin%' } },
        ],
      },
      attributes: ['id', 'name', 'business_name', 'email', 'subscription_status', 'is_active', 'created_at'],
      order: [['created_at', 'DESC']],
    });

    // Traer las suscripciones para conocer la fecha de vencimiento
    const subscriptions = await TenantSubscription.findAll({
      attributes: ['tenant_id', 'plan_code', 'status', 'current_period_end', 'grace_until'],
    });

    // Mapear por tenant_id para cruzar rápido
    const subsByTenant = {};
    subscriptions.forEach(s => { subsByTenant[s.tenant_id] = s; });

    const now = new Date();

    return tenants.map(tenant => {
      const sub = subsByTenant[tenant.id];
      const periodEnd = sub?.current_period_end || null;

      // Calcular días restantes (si hay fecha de vencimiento)
      let daysLeft = null;
      if (periodEnd) {
        daysLeft = Math.ceil((new Date(periodEnd) - now) / (1000 * 60 * 60 * 24));
      }

      return {
        id: tenant.id,
        name: tenant.name,
        business_name: tenant.business_name,
        email: tenant.email,
        subscription_status: tenant.subscription_status,
        is_active: tenant.is_active,
        plan_code: sub?.plan_code || null,
        current_period_end: periodEnd,
        days_left: daysLeft,
        created_at: tenant.created_at,
      };
    });
  }

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

  async deactivate(tenantId, actorUserId, reason = null) {
    const result = await sequelize.transaction(async (transaction) => {
      // 1) El tenant debe existir
      const tenant = await Tenant.findByPk(tenantId, { transaction });
      if (!tenant) {
        throw new NotFoundError('Tenant no encontrado');
      }

      // 2) Actualizar la suscripción a suspended (si existe)
      const subscription = await TenantSubscription.findOne({
        where: { tenant_id: tenantId },
        transaction,
      });
      if (subscription) {
        await subscription.update({ status: 'suspended' }, { transaction });
      }

      // 3) Sincronizar el estado simple del tenant
      await tenant.update({
        subscription_status: 'suspended',
        is_active: false,
      }, { transaction });

      return { tenant, subscription };
    });

    // Invalidar caché para que el bloqueo aplique al instante
    await tenantMiddleware.invalidateTenantCache(tenantId);

    // Auditoría
    await auditService.log({
      tenantId,
      userId: actorUserId,
      entityType: 'subscription',
      entityId: tenantId,
      action: 'suspend',
      description: `Tenant suspendido manualmente${reason ? `: ${reason}` : ''}`,
    });

    return {
      tenant_id: tenantId,
      status: 'suspended',
      is_active: false,
    };
  }

}

module.exports = new AdminSubscriptionService();