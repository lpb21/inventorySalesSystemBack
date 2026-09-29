/**
 * SMS Credit Service
 * Créditos SMS prepago por tenant: habilitar, acreditar paquetes/bono/ajustes,
 * reservar y consumir créditos al enviar, y reportes para el panel admin.
 *
 * Flujo de envío (lo usa customerNotificationService):
 *   reserveCredit  -> descuenta 1 de forma atómica (nunca deja el saldo negativo)
 *   sendSms        -> si sale bien: recordConsumption (queda en el libro)
 *                  -> si falla:     releaseCredit (se devuelve, no se cobra)
 */
const { Op, QueryTypes } = require('sequelize');
const {
  sequelize, Tenant, SmsCreditTransaction, SmsLog, SmsBalanceCheck, User,
} = require('../models');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { getPaginationSkip, formatPagination } = require('../utils/helpers');
const { SMS_PACKAGES, SMS_WELCOME_BONUS, listSmsPackages } = require('../config/smsPackages');
const tenantMiddleware = require('../middlewares/tenantMiddleware');
const auditService = require('./auditService');

// Saldo "bajo" para filtros y alertas del panel.
const LOW_BALANCE = 5;

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

class SmsCreditService {
  // ---------------------------------------------------------------------------
  // Consumo (envíos)
  // ---------------------------------------------------------------------------

  /**
   * Reserva 1 crédito de forma atómica. Dos ventas simultáneas con saldo 1
   * no pueden gastar el mismo crédito: el WHERE sms_balance > 0 lo garantiza.
   * @returns {Promise<{ reserved: true, balance: number, businessName: string }
   *                 | { reserved: false, reason: 'disabled' | 'no_balance' | 'not_found' }>}
   */
  async reserveCredit(tenantId) {
    const rows = await sequelize.query(
      `UPDATE tenants
          SET sms_balance = sms_balance - 1
        WHERE id = :tenantId AND sms_enabled = true AND sms_balance > 0
    RETURNING sms_balance, name, business_name`,
      { replacements: { tenantId }, type: QueryTypes.SELECT }
    );

    if (rows.length > 0) {
      const row = rows[0];
      return {
        reserved: true,
        balance: Number(row.sms_balance),
        businessName: row.business_name || row.name || '',
      };
    }

    const tenant = await Tenant.findByPk(tenantId, { attributes: ['sms_enabled', 'sms_balance'] });
    if (!tenant) return { reserved: false, reason: 'not_found' };
    if (!tenant.sms_enabled) return { reserved: false, reason: 'disabled' };
    return { reserved: false, reason: 'no_balance' };
  }

  /** Devuelve un crédito reservado cuyo SMS no salió. */
  async releaseCredit(tenantId) {
    await sequelize.query(
      'UPDATE tenants SET sms_balance = sms_balance + 1 WHERE id = :tenantId',
      { replacements: { tenantId } }
    );
  }

  /** Deja en el libro el crédito consumido por un SMS enviado. */
  async recordConsumption(tenantId, balanceAfter, smsLogId) {
    await SmsCreditTransaction.create({
      tenant_id: tenantId,
      type: 'consumption',
      amount: -1,
      balance_after: balanceAfter,
      sms_log_id: smsLogId,
    });
  }

  // ---------------------------------------------------------------------------
  // Movimientos manuales del superadmin
  // ---------------------------------------------------------------------------

  /**
   * Suma/resta créditos dentro de una transacción con bloqueo de fila y deja
   * el movimiento en el libro + audit_logs.
   */
  async _applyMovement(tenantId, { type, amount, packageCode = null, priceCop = null, note = null, oncePerTenant = false }, actorUserId) {
    const result = await sequelize.transaction(async (transaction) => {
      const tenant = await Tenant.findByPk(tenantId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!tenant) throw new NotFoundError('Tenant no encontrado');

      // Con la fila del tenant bloqueada, dos clics seguidos no pueden duplicar el bono.
      if (oncePerTenant) {
        const existing = await SmsCreditTransaction.findOne({
          where: { tenant_id: tenantId, type },
          transaction,
        });
        if (existing) {
          throw new ValidationError('Este tenant ya recibió el bono de bienvenida de SMS');
        }
      }

      const newBalance = tenant.sms_balance + amount;
      if (newBalance < 0) {
        throw new ValidationError(`El ajuste dejaría el saldo en negativo (saldo actual: ${tenant.sms_balance})`);
      }

      await tenant.update({ sms_balance: newBalance }, { transaction });
      const movement = await SmsCreditTransaction.create({
        tenant_id: tenantId,
        type,
        amount,
        balance_after: newBalance,
        package_code: packageCode,
        price_cop: priceCop,
        note,
        created_by: actorUserId,
      }, { transaction });

      return { tenant, movement };
    });

    await tenantMiddleware.invalidateTenantCache(tenantId);
    await auditService.log({
      tenantId,
      userId: actorUserId,
      entityType: 'sms_credits',
      entityId: tenantId,
      action: 'sms_credit',
      description: `SMS ${type}: ${amount > 0 ? '+' : ''}${amount} créditos (saldo: ${result.movement.balance_after})${packageCode ? `, paquete=${packageCode}` : ''}${note ? `, nota: ${note}` : ''}`,
    });

    return {
      tenant_id: tenantId,
      type,
      amount,
      sms_balance: result.movement.balance_after,
      transaction_id: result.movement.id,
    };
  }

  /** Bono de bienvenida: una sola vez por tenant. */
  async grantWelcomeBonus(tenantId, actorUserId) {
    return this._applyMovement(tenantId, {
      type: 'welcome_bonus',
      amount: SMS_WELCOME_BONUS,
      note: 'Bono de bienvenida',
      oncePerTenant: true,
    }, actorUserId);
  }

  /** Acredita un paquete comprado (pago recibido por fuera, igual que las suscripciones). */
  async purchasePackage(tenantId, packageCode, actorUserId, note = null) {
    const pkg = SMS_PACKAGES[packageCode];
    if (!pkg) {
      throw new ValidationError(`Paquete inválido: "${packageCode}"`);
    }
    return this._applyMovement(tenantId, {
      type: 'purchase',
      amount: pkg.credits,
      packageCode: pkg.code,
      priceCop: pkg.price_cop,
      note,
    }, actorUserId);
  }

  /** Ajuste manual (+/-), con nota obligatoria. */
  async adjust(tenantId, amount, note, actorUserId) {
    const value = parseInt(amount, 10);
    if (!Number.isInteger(value) || value === 0) {
      throw new ValidationError('La cantidad del ajuste debe ser un entero distinto de 0');
    }
    if (!note || !String(note).trim()) {
      throw new ValidationError('El ajuste requiere una nota con el motivo');
    }
    return this._applyMovement(tenantId, {
      type: 'adjustment',
      amount: value,
      note: String(note).trim(),
    }, actorUserId);
  }

  /** Habilita o deshabilita el envío de SMS de un tenant. No toca el saldo. */
  async setEnabled(tenantId, enabled, actorUserId) {
    const tenant = await Tenant.findByPk(tenantId);
    if (!tenant) throw new NotFoundError('Tenant no encontrado');

    await tenant.update({ sms_enabled: Boolean(enabled) });
    await tenantMiddleware.invalidateTenantCache(tenantId);
    await auditService.log({
      tenantId,
      userId: actorUserId,
      entityType: 'sms_credits',
      entityId: tenantId,
      action: enabled ? 'sms_enable' : 'sms_disable',
      description: `SMS a clientes ${enabled ? 'habilitado' : 'deshabilitado'} por superadmin`,
    });

    return { tenant_id: tenantId, sms_enabled: tenant.sms_enabled, sms_balance: tenant.sms_balance };
  }

  // ---------------------------------------------------------------------------
  // Consultas
  // ---------------------------------------------------------------------------

  /** Estado para el propio tenant (panel de configuración / POS). */
  async getTenantStatus(tenantId) {
    const tenant = await Tenant.findByPk(tenantId, { attributes: ['id', 'sms_enabled', 'sms_balance'] });
    if (!tenant) throw new NotFoundError('Tenant no encontrado');

    const sentThisMonth = await SmsLog.count({
      where: { tenant_id: tenantId, status: 'sent', created_at: { [Op.gte]: startOfMonth() } },
    });

    return {
      sms_enabled: tenant.sms_enabled,
      sms_balance: tenant.sms_balance,
      sent_this_month: sentThisMonth,
      packages: listSmsPackages(),
    };
  }

  /**
   * Vista general para el superadmin: tabla de tenants paginada y filtrable +
   * totales GLOBALES del mes (no dependen de los filtros) + última alerta Twilio.
   * @param {object} filters
   * @param {string} [filters.tenantId]  un tenant puntual
   * @param {'enabled'|'disabled'} [filters.sms]
   * @param {'empty'|'low'|'available'} [filters.balance]  0 | 1..LOW | > LOW
   */
  async getAdminOverview({ page = 1, limit = 20, tenantId, sms, balance } = {}) {
    const monthStart = startOfMonth();
    const baseWhere = { name: { [Op.notILike]: '%Global Admin%' } };

    // --- Tabla (filtrada y paginada) ---
    const where = { ...baseWhere };
    if (tenantId) where.id = tenantId;
    if (sms === 'enabled') where.sms_enabled = true;
    if (sms === 'disabled') where.sms_enabled = false;
    if (balance === 'empty') where.sms_balance = 0;
    if (balance === 'low') where.sms_balance = { [Op.between]: [1, LOW_BALANCE] };
    if (balance === 'available') where.sms_balance = { [Op.gt]: LOW_BALANCE };

    const { count, rows: tenants } = await Tenant.findAndCountAll({
      where,
      attributes: ['id', 'name', 'business_name', 'is_active', 'subscription_status', 'sms_enabled', 'sms_balance'],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: getPaginationSkip(page, limit),
    });
    const pageIds = tenants.map((t) => t.id);

    const stats = pageIds.length
      ? await SmsLog.findAll({
        where: { tenant_id: { [Op.in]: pageIds }, created_at: { [Op.gte]: monthStart } },
        attributes: ['tenant_id', 'status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
        group: ['tenant_id', 'status'],
        raw: true,
      })
      : [];
    const statsByTenant = {};
    stats.forEach((s) => {
      statsByTenant[s.tenant_id] = statsByTenant[s.tenant_id] || { sent: 0, failed: 0, skipped: 0 };
      statsByTenant[s.tenant_id][s.status] = Number(s.count);
    });

    const bonuses = pageIds.length
      ? await SmsCreditTransaction.findAll({
        where: { type: 'welcome_bonus', tenant_id: { [Op.in]: pageIds } },
        attributes: ['tenant_id'],
        raw: true,
      })
      : [];
    const bonusSet = new Set(bonuses.map((b) => b.tenant_id));

    const lastPurchases = pageIds.length
      ? await SmsCreditTransaction.findAll({
        where: { type: 'purchase', tenant_id: { [Op.in]: pageIds } },
        attributes: ['tenant_id', [sequelize.fn('MAX', sequelize.col('created_at')), 'last_purchase_at']],
        group: ['tenant_id'],
        raw: true,
      })
      : [];
    const lastPurchaseByTenant = {};
    lastPurchases.forEach((p) => { lastPurchaseByTenant[p.tenant_id] = p.last_purchase_at; });

    const rows = tenants.map((t) => ({
      id: t.id,
      name: t.business_name || t.name,
      is_active: t.is_active,
      subscription_status: t.subscription_status,
      sms_enabled: t.sms_enabled,
      sms_balance: t.sms_balance,
      welcome_bonus_granted: bonusSet.has(t.id),
      last_purchase_at: lastPurchaseByTenant[t.id] || null,
      month: statsByTenant[t.id] || { sent: 0, failed: 0, skipped: 0 },
    }));

    // --- Totales globales (todas las filas, sin filtros) ---
    const [committedCredits, enabledTenants, monthByStatus] = await Promise.all([
      Tenant.sum('sms_balance', { where: baseWhere }),
      Tenant.count({ where: { ...baseWhere, sms_enabled: true } }),
      SmsLog.findAll({
        where: { tenant_id: { [Op.ne]: null }, created_at: { [Op.gte]: monthStart } },
        attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
        group: ['status'],
        raw: true,
      }),
    ]);
    const totals = {
      committed_credits: Number(committedCredits) || 0,
      enabled_tenants: enabledTenants,
      sent: 0,
      failed: 0,
      skipped: 0,
    };
    monthByStatus.forEach((s) => {
      if (s.status in totals) totals[s.status] = Number(s.count);
    });

    const lastCheck = await SmsBalanceCheck.findOne({ order: [['created_at', 'DESC']] });

    return {
      tenants: rows,
      pagination: formatPagination(page, limit, count),
      totals,
      packages: listSmsPackages(),
      welcome_bonus: SMS_WELCOME_BONUS,
      low_balance: LOW_BALANCE,
      balance_check: lastCheck,
    };
  }

  /** Libro de movimientos de un tenant (sin los consumos, que están en los logs). */
  async listTransactions(tenantId, { page = 1, limit = 20, includeConsumption = false } = {}) {
    const where = { tenant_id: tenantId };
    if (!includeConsumption) where.type = { [Op.ne]: 'consumption' };

    const { count, rows } = await SmsCreditTransaction.findAndCountAll({
      where,
      include: [{ model: User, as: 'creator', attributes: ['id', 'name', 'email'] }],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: getPaginationSkip(page, limit),
    });
    return { transactions: rows, pagination: formatPagination(page, limit, count) };
  }

  /** Últimos intentos de envío de un tenant. */
  async listLogs(tenantId, { page = 1, limit = 20 } = {}) {
    const { count, rows } = await SmsLog.findAndCountAll({
      where: { tenant_id: tenantId },
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: getPaginationSkip(page, limit),
    });
    return { logs: rows, pagination: formatPagination(page, limit, count) };
  }
}

module.exports = new SmsCreditService();
