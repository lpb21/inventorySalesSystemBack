/**
 * User Routes
 * Routes for user management endpoints
 */
const express = require('express');
const router = express.Router();
const userController = require('../../controllers/userController');
const authMiddleware = require('../../middlewares/authMiddleware');
const tenantMiddleware = require('../../middlewares/tenantMiddleware');
const { permissionMiddleware } = require('../../middlewares/permissionMiddleware');
const { validate } = require('../../middlewares/validationMiddleware');
const { createUserSchema, updateUserSchema, resetPasswordSchema } = require('../../utils/validators');

// Apply auth and tenant middleware to all routes
router.use(authMiddleware);
router.use(tenantMiddleware);

// User management routes
router.get('/', permissionMiddleware('users:read'), userController.getUsers);
router.post('/', permissionMiddleware('users:create'), validate(createUserSchema), userController.createUser);
router.get('/:id', permissionMiddleware('users:read'), userController.getUserById);
router.put('/:id', permissionMiddleware('users:update'), validate(updateUserSchema), userController.updateUser);
router.delete('/:id', permissionMiddleware('users:delete'), userController.deleteUser);
router.put('/:id/reset-password', permissionMiddleware('users:update'), validate(resetPasswordSchema), userController.resetPassword);
router.put('/:id/toggle-status', permissionMiddleware('users:update'), userController.toggleStatus);

module.exports = router;
