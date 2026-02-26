/**
 * Category Routes
 * Routes for category management endpoints
 */
const express = require('express');
const router = express.Router();
const categoryController = require('../../controllers/categoryController');
const authMiddleware = require('../../middlewares/authMiddleware');
const tenantMiddleware = require('../../middlewares/tenantMiddleware');
const { permissionMiddleware } = require('../../middlewares/permissionMiddleware');
const { validate } = require('../../middlewares/validationMiddleware');
const { categorySchema } = require('../../utils/validators');

// Apply auth and tenant middleware to all routes
router.use(authMiddleware);
router.use(tenantMiddleware);

// Category routes
router.get('/', permissionMiddleware('categories:read'), categoryController.getCategories);
router.post('/', permissionMiddleware('categories:create'), validate(categorySchema), categoryController.createCategory);
router.get('/:id', permissionMiddleware('categories:read'), categoryController.getCategoryById);
router.put('/:id', permissionMiddleware('categories:update'), validate(categorySchema), categoryController.updateCategory);
router.delete('/:id', permissionMiddleware('categories:delete'), categoryController.deleteCategory);

module.exports = router;
