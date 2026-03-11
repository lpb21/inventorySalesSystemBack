/**
 * Sale Routes
 * Routes for sales management endpoints
 */
const express = require('express');
const router = express.Router();
const saleController = require('../../controllers/saleController');
const authMiddleware = require('../../middlewares/authMiddleware');
const tenantMiddleware = require('../../middlewares/tenantMiddleware');
const { permissionMiddleware } = require('../../middlewares/permissionMiddleware');
const { validate } = require('../../middlewares/validationMiddleware');
const { saleSchema, cancelSaleSchema } = require('../../utils/validators');
const { writeOperationsLimiter } = require('../../middlewares/rateLimitMiddleware');

// Apply auth and tenant middleware to all routes
router.use(authMiddleware);
router.use(tenantMiddleware);

// Sale routes
router.get('/', permissionMiddleware('sales:read'), saleController.getSales);
router.post('/', writeOperationsLimiter, permissionMiddleware('sales:create'), validate(saleSchema), saleController.createSale);
router.get('/today', permissionMiddleware('sales:read'), saleController.getTodaySales);
router.get('/by-date', permissionMiddleware('sales:read'), saleController.getSalesByDate);
router.get('/:id', permissionMiddleware('sales:read'), saleController.getSaleById);
router.post('/:id/cancel', writeOperationsLimiter, permissionMiddleware('sales:cancel'), validate(cancelSaleSchema), saleController.cancelSale);

module.exports = router;
