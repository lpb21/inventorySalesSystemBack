/**
 * Auth Controller
 * Handles authentication endpoints
 */
const authService = require('../services/authService');
const { asyncHandler, formatResponse, formatError } = require('../utils/helpers');

class AuthController {
  /**
   * POST /v1/auth/login
   * Login user
   */
  login = asyncHandler(async (req, res, next) => {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.status(200).json(formatResponse(result));
  });

  /**
   * POST /v1/auth/register
   * Register new tenant with owner user
   */
  register = asyncHandler(async (req, res, next) => {
    const result = await authService.register(req.body);
    res.status(201).json(formatResponse(result));
  });

  /**
   * GET /v1/auth/me
   * Get current user
   */
  me = asyncHandler(async (req, res, next) => {
    const user = await authService.getCurrentUser(req.user.id);
    res.status(200).json(formatResponse(user));
  });

  /**
   * POST /v1/auth/refresh-token
   * Refresh JWT token
   */
  refreshToken = asyncHandler(async (req, res, next) => {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json(formatError({
        message: 'Token requerido',
        statusCode: 400,
        errorCode: 'TOKEN_REQUIRED',
      }));
    }
    const newToken = await authService.refreshToken(token);
    res.status(200).json(formatResponse({ token: newToken }));
  });
}

module.exports = new AuthController();
