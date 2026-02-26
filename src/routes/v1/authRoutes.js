/**
 * Auth Routes
 * Routes for authentication endpoints
 */
const express = require('express');
const router = express.Router();
const authController = require('../../controllers/authController');
const { validate } = require('../../middlewares/validationMiddleware');
const { loginSchema, registerSchema } = require('../../utils/validators');

// Public routes
router.post('/login', validate(loginSchema), authController.login);
router.post('/register', validate(registerSchema), authController.register);
router.post('/refresh-token', authController.refreshToken);

module.exports = router;
