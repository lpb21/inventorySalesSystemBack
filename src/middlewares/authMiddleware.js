/**
 * Auth Middleware
 * Validates JWT token and attaches user to request
 */
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { AuthenticationError } = require('../utils/errors');
const { User } = require('../models');

const authMiddleware = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('No se proporcionó token de autenticación');
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify token
    const decoded = jwt.verify(token, env.jwt.secret);
    
    // Get user from database
    const user = await User.findByPk(decoded.userId);
    
    if (!user) {
      throw new AuthenticationError('Usuario no encontrado');
    }
    
    if (!user.is_active) {
      throw new AuthenticationError('Usuario inactivo');
    }
    
    // Attach user to request
    req.user = {
      id: user.id,
      userId: user.id,        // alias para compatibilidad con controllers
      tenantId: user.tenant_id,
      email: user.email,
      role: user.role,
      isSuperadmin: user.is_superadmin,
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

module.exports = authMiddleware;
