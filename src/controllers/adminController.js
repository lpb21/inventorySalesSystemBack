/**
 * Admin Controller
 * Endpoints administrativos (solo superadmin).
 */
const adminSubscriptionService = require('../services/adminSubscriptionService');
const { asyncHandler, formatResponse } = require('../utils/helpers');

class AdminController {
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
}

module.exports = new AdminController();