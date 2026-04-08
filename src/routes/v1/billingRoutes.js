/**
 * Billing Routes
 * /v1/billing
 */
const express = require('express');
const router = express.Router();
const billingController = require('../../controllers/billingController');
const authMiddleware = require('../../middlewares/authMiddleware');
const tenantMiddleware = require('../../middlewares/tenantMiddleware');
const { roleMiddleware } = require('../../middlewares/permissionMiddleware');
const { validate } = require('../../middlewares/validationMiddleware');
const { createWompiCheckoutSessionSchema } = require('../../utils/validators');

// Public webhook endpoint (provider callback)
router.post('/epayco/webhook', billingController.handleEpaycoWebhook);

// Public renewal endpoint - validate if email can renew subscription
router.post('/epayco/renewal/session', billingController.initiateRenewal);

// Public checkout endpoint for anonymous users
router.post('/epayco/checkout-anonymous', billingController.createAnonymousCheckoutSession);

// Public Smart Checkout v2 endpoint (widget/modal) - supports renewal with renewal_token
router.post('/epayco/smart-checkout/session', billingController.createSmartCheckoutSession);

// Authenticated billing endpoints
router.use(authMiddleware);
router.use(tenantMiddleware);

// Get available billing plans
router.get('/plans', billingController.getPlans);

router.post(
  '/epayco/checkout-session',
  roleMiddleware(['owner', 'admin', 'superadmin']),
  validate(createWompiCheckoutSessionSchema),
  billingController.createCheckoutSession
);

router.get('/subscription', billingController.getMySubscription);

router.post(
  '/subscription/enforce-overdue',
  roleMiddleware(['owner', 'superadmin']),
  billingController.enforceOverdue
);

module.exports = router;
