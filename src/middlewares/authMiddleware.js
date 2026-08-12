/**
 * Auth Middleware
 * Validates JWT token and attaches user to request
 * Uses Redis cache to avoid querying the DB on every request
 */
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { AuthenticationError } = require('../utils/errors');
const { User } = require('../models');
const cacheService = require('../services/cacheService');

const USER_CACHE_TTL = 120; // 2 minutes

const getUserCacheKey = (userId) => `auth:user:${userId}`;

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No se proporcionó token de autenticación');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.jwt.secret);

    const cacheKey = getUserCacheKey(decoded.userId);
    let userData = await cacheService.get(cacheKey);

    if (!userData) {
      const user = await User.findByPk(decoded.userId);

      if (!user) {
        throw new AuthenticationError('Usuario no encontrado');
      }

      if (!user.is_active) {
        throw new AuthenticationError('Usuario inactivo');
      }

      userData = {
        id: user.id,
        userId: user.id,
        tenantId: user.tenant_id,
        email: user.email,
        role: user.role,
        isSuperadmin: user.is_superadmin,
        is_active: user.is_active,
      };

      cacheService.set(cacheKey, userData, USER_CACHE_TTL).catch(() => {});
    } else if (!userData.is_active) {
      throw new AuthenticationError('Usuario inactivo');
    }

    req.user = {
      id: userData.id,
      userId: userData.id,
      tenantId: userData.tenantId,
      email: userData.email,
      role: userData.role,
      isSuperadmin: userData.isSuperadmin,
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      next(new AuthenticationError('Token inválido'));
    } else if (error.name === 'TokenExpiredError') {
      next(new AuthenticationError('Token expirado'));
    } else {
      next(error);
    }
  }
};

authMiddleware.invalidateUserCache = async (userId) => {
  await cacheService.invalidateKeys([getUserCacheKey(userId)]);
};

module.exports = authMiddleware;