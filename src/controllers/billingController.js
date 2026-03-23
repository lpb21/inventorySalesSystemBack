/**
 * Billing Controller
 */
const billingService = require('../services/billingService');
const { asyncHandler, formatResponse } = require('../utils/helpers');

class BillingController {
  /**
   * POST /v1/billing/epayco/checkout-session
   */
  createCheckoutSession = asyncHandler(async (req, res) => {
    const { plan_code } = req.body;

    const result = await billingService.createCheckoutSession({
      tenantId: req.tenantId,
      user: req.user,
      planCode: plan_code,
    });

    res.status(200).json(formatResponse(result));
  });

  /**
   * POST /v1/billing/epayco/webhook
   */
  handleEpaycoWebhook = asyncHandler(async (req, res) => {
    const result = await billingService.processEpaycoWebhook(req.body);
    res.status(200).json({
      success: true,
      data: result,
    });
  });

  /**
   * GET /v1/billing/subscription
   */
  getMySubscription = asyncHandler(async (req, res) => {
    const subscription = await billingService.getTenantSubscription(req.tenantId);
    res.status(200).json(formatResponse(subscription));
  });

  /**
   * POST /v1/billing/subscription/enforce-overdue
   */
  enforceOverdue = asyncHandler(async (req, res) => {
    const result = await billingService.enforceOverdueSubscriptions();
    res.status(200).json(formatResponse(result));
  });
}

module.exports = new BillingController();
