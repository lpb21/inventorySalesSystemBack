/**
 * Product Routes
 * Routes for product management endpoints
 */
const express = require('express');
const router = express.Router();
const productController = require('../../controllers/productController');
const authMiddleware = require('../../middlewares/authMiddleware');
const tenantMiddleware = require('../../middlewares/tenantMiddleware');
const { permissionMiddleware } = require('../../middlewares/permissionMiddleware');
const { validate } = require('../../middlewares/validationMiddleware');
const { productSchema, updateProductSchema } = require('../../utils/validators');

// Apply auth and tenant middleware to all routes
router.use(authMiddleware);
router.use(tenantMiddleware);

// Product routes
router.get('/', permissionMiddleware('products:read'), productController.getProducts);
router.post('/', permissionMiddleware('products:create'), validate(productSchema), productController.createProduct);
router.get('/low-stock', permissionMiddleware('products:read'), productController.getLowStock);
router.get('/search', permissionMiddleware('products:read'), productController.searchProducts);
router.get('/barcode/:code', permissionMiddleware('products:read'), productController.getProductByBarcode);
router.get('/:id', permissionMiddleware('products:read'), productController.getProductById);
router.put('/:id', permissionMiddleware('products:update'), validate(updateProductSchema), productController.updateProduct);
router.delete('/:id', permissionMiddleware('products:delete'), productController.deleteProduct);

module.exports = router;
