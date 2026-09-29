/**
 * SMS Controller
 * - Tenant: consulta su estado de SMS y envía el aviso de un fiado/abono (botón del modal).
 * - Superadmin: habilita, acredita y audita los SMS de cada tenant.
 */
const smsCreditService = require('../services/smsCreditService');
const smsBalanceAlertService = require('../services/smsBalanceAlertService');
const customerNotificationService = require('../services/customerNotificationService');
const { asyncHandler, formatResponse } = require('../utils/helpers');
const { ValidationError } = require('../utils/errors');

class SmsController {
  /**
   * GET /v1/sms/status
   * Estado de SMS del tenant del usuario logueado.
   */
  getStatus = asyncHandler(async (req, res) => {
    if (!req.tenantId) {
      throw new ValidationError('Este usuario no pertenece a una empresa');
    }
    const result = await smsCreditService.getTenantStatus(req.tenantId);
    res.status(200).json(formatResponse(result));
  });

  /**
   * POST /v1/sales/:id/notify-sms
   * El tendero envía al cliente el aviso de un fiado.
   */
  notifySale = asyncHandler(async (req, res) => {
    const tenantId = req.tenantId || req.tenant?.id;
    if (!tenantId) throw new ValidationError('Este usuario no pertenece a una empresa');
    const result = await customerNotificationService.notifySale(tenantId, req.params.id);
    res.status(200).json(formatResponse(result));
  });

  /**
   * POST /v1/customers/:id/payments/:paymentId/notify-sms
   * El tendero envía al cliente el aviso de un abono.
   */
  notifyPayment = asyncHandler(async (req, res) => {
    const tenantId = req.tenantId || req.tenant?.id;
    if (!tenantId) throw new ValidationError('Este usuario no pertenece a una empresa');
    const result = await customerNotificationService.notifyPayment(
      tenantId,
      req.params.id,
      req.params.paymentId
    );
    res.status(200).json(formatResponse(result));
  });

  /**
   * GET /v1/admin/sms/overview?page&limit&tenantId&sms=enabled|disabled&balance=empty|low|available
   */
  adminOverview = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, tenantId, sms, balance } = req.query;
    const result = await smsCreditService.getAdminOverview({
      page: parseInt(page),
      limit: Math.min(parseInt(limit) || 20, 100),
      tenantId: tenantId || undefined,
      sms: ['enabled', 'disabled'].includes(sms) ? sms : undefined,
      balance: ['empty', 'low', 'available'].includes(balance) ? balance : undefined,
    });
    res.status(200).json(formatResponse(result));
  });

  /**
   * POST /v1/admin/sms/balance-check
   * Corre el chequeo de saldo Twilio ya mismo (además del cron).
   */
  runBalanceCheck = asyncHandler(async (req, res) => {
    const result = await smsBalanceAlertService.runCheck();
    res.status(200).json(formatResponse(result));
  });

  /**
   * PATCH /v1/admin/tenants/:id/sms
   * Body: { enabled }
   */
  setEnabled = asyncHandler(async (req, res) => {
    const result = await smsCreditService.setEnabled(req.params.id, req.body.enabled, req.user.userId);
    res.status(200).json(formatResponse(result));
  });

  /**
   * POST /v1/admin/tenants/:id/sms/welcome-bonus
   */
  grantWelcomeBonus = asyncHandler(async (req, res) => {
    const result = await smsCreditService.grantWelcomeBonus(req.params.id, req.user.userId);
    res.status(200).json(formatResponse(result));
  });

  /**
   * POST /v1/admin/tenants/:id/sms/credits
   * Body: { package_code, note? } (compra) | { amount, note } (ajuste manual)
   */
  addCredits = asyncHandler(async (req, res) => {
    const { package_code: packageCode, amount, note } = req.body;
    const result = packageCode
      ? await smsCreditService.purchasePackage(req.params.id, packageCode, req.user.userId, note || null)
      : await smsCreditService.adjust(req.params.id, amount, note, req.user.userId);
    res.status(200).json(formatResponse(result));
  });

  /**
   * GET /v1/admin/tenants/:id/sms/transactions
   */
  listTransactions = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const result = await smsCreditService.listTransactions(req.params.id, { page, limit });
    res.status(200).json(formatResponse(result));
  });

  /**
   * GET /v1/admin/tenants/:id/sms/logs
   */
  listLogs = asyncHandler(async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const result = await smsCreditService.listLogs(req.params.id, { page, limit });
    res.status(200).json(formatResponse(result));
  });
}

module.exports = new SmsController();
