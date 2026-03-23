/**
 * Auth Routes
 * Routes for authentication endpoints
 */
const express = require('express');
const router = express.Router();
const authController = require('../../controllers/authController');
const authMiddleware = require('../../middlewares/authMiddleware');
const { roleMiddleware } = require('../../middlewares/permissionMiddleware');
const { validate } = require('../../middlewares/validationMiddleware');
const { loginSchema, registerSchema, changePasswordSchema, resetPasswordSchema } = require('../../utils/validators');
const { authLimiter } = require('../../middlewares/rateLimitMiddleware');

// Public routes with strict rate limiting
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/refresh-token', authLimiter, authController.refreshToken);

// Protected routes
router.get('/me', authMiddleware, authController.me);

// Change own password (any authenticated user)
router.post('/change-password', authMiddleware, validate(changePasswordSchema), authController.changePassword);

// Reset user password (owner/superadmin only)
router.post('/reset-password/:userId', authMiddleware, roleMiddleware(['owner', 'superadmin']), validate(resetPasswordSchema), authController.resetPassword);

module.exports = router;
