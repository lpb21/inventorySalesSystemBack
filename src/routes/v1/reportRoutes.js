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

// Apply auth and tenant middleware to all routes
router.use(authMiddleware);
router.use(tenantMiddleware);

// Report routes
router.get('/dashboard', permissionMiddleware('reports:read'), reportController.getDashboard);
router.get('/sales', permissionMiddleware('reports:read'), reportController.getSalesReport);
router.get('/inventory', permissionMiddleware('reports:read'), reportController.getInventoryReport);
router.get('/profits', permissionMiddleware('reports:read'), reportController.getProfitReport);
router.get('/top-products', permissionMiddleware('reports:read'), reportController.getTopProducts);
router.get('/low-stock', permissionMiddleware('reports:read'), reportController.getLowStockReport);

module.exports = router;
