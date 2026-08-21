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
}

module.exports = new AdminController();