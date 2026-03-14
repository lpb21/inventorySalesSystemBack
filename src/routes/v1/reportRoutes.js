/**
 * Report Routes
 * Routes for report endpoints
 */
const express = require('express');
const router = express.Router();
const reportController = require('../../controllers/reportController');
const authMiddleware = require('../../middlewares/authMiddleware');
const tenantMiddleware = require('../../middlewares/tenantMiddleware');
const { permissionMiddleware } = require('../../middlewares/permissionMiddleware');
const { requireFeature } = require('../../middlewares/planMiddleware');
const { reportLimiter } = require('../../middlewares/rateLimitMiddleware');

// Apply auth and tenant middleware to all routes
router.use(authMiddleware);
router.use(tenantMiddleware);

// Apply report-specific rate limiting
router.use(reportLimiter);

// Report routes
router.get('/dashboard', permissionMiddleware('reports:read'), reportController.getDashboard);
router.get('/sales', permissionMiddleware('reports:read'), reportController.getSalesReport);
router.get('/inventory', permissionMiddleware('reports:read'), reportController.getInventoryReport);
router.get('/profits', permissionMiddleware('reports:read'), requireFeature('advancedReports'), reportController.getProfitReport);
router.get('/top-products', permissionMiddleware('reports:read'), requireFeature('advancedReports'), reportController.getTopProducts);
router.get('/low-stock', permissionMiddleware('reports:read'), reportController.getLowStockReport);
router.get('/low-rotation', permissionMiddleware('reports:read'), requireFeature('advancedReports'), reportController.getLowRotationProducts);
router.get('/audit-logs', permissionMiddleware('reports:read'), requireFeature('advancedReports'), reportController.getAuditLogs);

module.exports = router;
