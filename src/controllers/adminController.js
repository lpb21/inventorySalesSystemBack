/**
 * Admin Controller
 * Endpoints administrativos (solo superadmin).
 */
const adminSubscriptionService = require('../services/adminSubscriptionService');
const { asyncHandler, formatResponse } = require('../utils/helpers');
const auditService = require('../services/auditService');

class AdminController {
  /**
   * POST /v1/admin/tenants
   * Crea un cliente completo (tenant + owner + suscripción). Solo superadmin.
   */
  createTenant = asyncHandler(async (req, res) => {
    const result = await adminSubscriptionService.createTenant(req.body, req.user.userId);
    res.status(201).json(formatResponse(result));
  });
  
  /**
   * POST /v1/admin/tenants/:id/activate
   * Activa o renueva la suscripción de un tenant.
   */
  activateTenant = asyncHandler(async (req, res) => {
    const { period } = req.body;
    const result = await adminSubscriptionService.activate(
      req.params.id,
      period,
      req.user.userId
    );

    res.status(200).json(formatResponse(result));
  });

    /**
   * GET /v1/admin/tenants
   * Lista todos los tenants con su estado de suscripción.
   */
  listTenants = asyncHandler(async (req, res) => {
    const result = await adminSubscriptionService.list();
    res.status(200).json(formatResponse(result));
  });

    /**
   * POST /v1/admin/tenants/:id/deactivate
   * Suspende manualmente un tenant (reversible).
   */
  deactivateTenant = asyncHandler(async (req, res) => {
    const { reason } = req.body;
    const result = await adminSubscriptionService.deactivate(
      req.params.id,
      req.user.userId,
      reason
    );
    res.status(200).json(formatResponse(result));
  });

    /**
   * GET /v1/admin/audit-logs
   * Historial global de auditoría, todos los tenants (solo superadmin).
   */
    auditLogs = asyncHandler(async (req, res) => {
    const { page = 1, limit = 30, tenantId, action } = req.query;
    const result = await auditService.getGlobalAuditLogs({
      page: parseInt(page),
      limit: parseInt(limit),
      tenantId: tenantId || undefined,
      action: action || undefined,
    });
    res.status(200).json(formatResponse(result));
  });
}

module.exports = new AdminController();