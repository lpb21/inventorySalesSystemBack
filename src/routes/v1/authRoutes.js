/**
 * Auth Routes
 * Routes for authentication endpoints
 */
const express = require('express');
const router = express.Router();
const authController = require('../../controllers/authController');
const authMiddleware = require('../../middlewares/authMiddleware');
const { validate } = require('../../middlewares/validationMiddleware');
const { loginSchema, registerSchema } = require('../../utils/validators');

// Public routes
router.post('/login', validate(loginSchema), authController.login);
router.post('/register', validate(registerSchema), authController.register);
router.post('/refresh-token', authController.refreshToken);

// Protected route - get current user (me)
router.get('/me', authMiddleware, authController.me);

module.exports = router;
