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
router.post('/wompi/webhook', billingController.handleWompiWebhook);

// Authenticated billing endpoints
router.use(authMiddleware);
router.use(tenantMiddleware);

router.post(
  '/wompi/checkout-session',
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
