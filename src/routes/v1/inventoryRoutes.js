/**
 * Inventory Routes
 * Routes for inventory management endpoints
 */
const express = require('express');
const router = express.Router();
const inventoryController = require('../../controllers/inventoryController');
const authMiddleware = require('../../middlewares/authMiddleware');
const tenantMiddleware = require('../../middlewares/tenantMiddleware');
const { permissionMiddleware } = require('../../middlewares/permissionMiddleware');
const { validate } = require('../../middlewares/validationMiddleware');
const { inventoryAdjustmentSchema, transformSchema } = require('../../utils/validators');

// Apply auth and tenant middleware to all routes
router.use(authMiddleware);
router.use(tenantMiddleware);

// Inventory routes
router.get('/', permissionMiddleware('inventory:read'), inventoryController.getInventory);
router.post('/adjust', permissionMiddleware('inventory:adjust'), validate(inventoryAdjustmentSchema), inventoryController.adjustInventory);
router.post('/bulk-adjust', permissionMiddleware('inventory:adjust'), inventoryController.bulkAdjust);
router.get('/movements', permissionMiddleware('inventory:movements'), inventoryController.getMovements);
router.get('/movements/:productId', permissionMiddleware('inventory:read'), inventoryController.getProductMovements);
router.post('/transform', permissionMiddleware('inventory:adjust'), validate(transformSchema), inventoryController.transform);

module.exports = router;
