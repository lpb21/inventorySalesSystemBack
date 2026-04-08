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
   * POST /v1/billing/epayco/checkout-anonymous
   * Public endpoint for creating checkout sessions without authentication
   */
  createAnonymousCheckoutSession = asyncHandler(async (req, res) => {
    const { email, plan_code, name, business_name } = req.body;

    // Validate required fields
    if (!email || !plan_code) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email y plan_code son requeridos'
        }
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email inválido'
        }
      });
    }

    // Validate plan exists
    const billingPlans = require('../config/billingPlans');
    if (!billingPlans[plan_code]) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Plan no válido'
        }
      });
    }

    const result = await billingService.createAnonymousCheckoutSession({
      email,
      planCode: plan_code,
      name: name || 'Usuario',
      businessName: business_name || 'Mi Empresa'
    });

    res.status(200).json(formatResponse(result));
  });

  /**
   * POST /v1/billing/epayco/smart-checkout/session
   * Public endpoint for creating Smart Checkout v2 sessions (widget/modal)
   * Returns token for rendering widget, not URL for redirect
   * 
   * Can include renewal_token for existing expired subscriptions
   */
  createSmartCheckoutSession = asyncHandler(async (req, res) => {
    const { email, plan_code, name, business_name, renewal_token } = req.body;

    // Validate required fields
    if (!email || !plan_code) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email y plan_code son requeridos'
        }
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email inválido'
        }
      });
    }

    // Validate plan exists
    const billingPlans = require('../config/billingPlans');
    if (!billingPlans[plan_code]) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Plan no válido'
        }
      });
    }

    // If renewal_token provided, validate it
    if (renewal_token) {
      try {
        await billingService.validateRenewalToken(email, renewal_token);
        console.log(`[SMART_CHECKOUT] Renovación validada para ${email}`);
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'RENEWAL_ERROR',
            message: error.message
          }
        });
      }
    }

    const result = await billingService.createSmartCheckoutSession({
      email,
      planCode: plan_code,
      name: name || 'Usuario',
      businessName: business_name || 'Mi Empresa',
      renewalToken: renewal_token, // Pass to service for metadata
      isRenewal: !!renewal_token
    });

    res.status(200).json(formatResponse(result));
  });

  /**
   * POST /v1/billing/epayco/renewal/session
   * Public endpoint to initiate renewal for expired subscriptions
   * Validates email exists and subscription is renewble, returns temporary renewal token
   */
  initiateRenewal = asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email es requerido'
        }
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Email inválido'
        }
      });
    }

    const result = await billingService.initiateRenewal(email);
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
   * GET /v1/billing/plans
   */
  getPlans = asyncHandler(async (req, res) => {
    const billingPlans = require('../config/billingPlans');
    const plans = require('../config/plans');

    // Transform billing plans to frontend-friendly format
    const plansArray = Object.keys(billingPlans).map(planCode => {
      const billing = billingPlans[planCode];
      const limits = plans[planCode];

      return {
        code: billing.code,
        name: billing.displayName,
        price: {
          amount_cents: billing.amountInCents,
          amount_formatted: `$${(billing.amountInCents / 100).toLocaleString()} COP`,
          currency: billing.currency,
          is_free: billing.amountInCents === 0
        },
        billing_cycle: {
          days: billing.cycleDays,
          period: billing.cycleDays === 30 ? 'monthly' : `${billing.cycleDays} days`
        },
        features: {
          max_products: limits?.maxProducts || 0,
          max_users: limits?.maxUsers || 0,
          max_categories: limits?.maxCategories || 0,
          max_suppliers: limits?.maxSuppliers || 0,
          has_reports: limits?.features?.reports || false,
          has_backups: limits?.features?.backups || false,
          has_integrations: limits?.features?.integrations || false,
          support_level: limits?.features?.supportLevel || 'basic'
        }
      };
    });

    res.status(200).json(formatResponse({ plans: plansArray }));
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
