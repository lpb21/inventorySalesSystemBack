/**
 * Tenant Middleware
 * Validates and sets tenant context for the request
 */
const { Tenant } = require('../models');
const { AuthenticationError } = require('../utils/errors');

const tenantMiddleware = async (req, res, next) => {
  try {
    // If user is superadmin, allow access to all tenants
    if (req.user.isSuperadmin) {
      // For superadmin, tenantId can be passed in header or query
      req.tenantId = req.headers['x-tenant-id'] || req.user.tenantId;
      return next();
    }
    
    // For regular users, use their assigned tenant
    if (!req.user.tenantId) {
      throw new AuthenticationError('No se encontró el tenant del usuario');
    }
    
    // Verify tenant exists and is active
    const tenant = await Tenant.findByPk(req.user.tenantId);
    
    if (!tenant) {
      throw new AuthenticationError('Tenant no encontrado');
    }
    
    if (!tenant.is_active) {
      throw new AuthenticationError('La empresa está inactiva');
    }
    
    // Check subscription status
    if (tenant.subscription_status === 'suspended') {
      throw new AuthenticationError('Suscripción suspendida');
    }
    
    if (tenant.subscription_status === 'cancelled') {
      throw new AuthenticationError('Suscripción cancelada');
    }
    
    // Check if trial period has expired
    if (tenant.subscription_status === 'trial' && tenant.trial_ends_at) {
      const trialEnd = new Date(tenant.trial_ends_at);
      if (trialEnd < new Date()) {
        throw new AuthenticationError('Período de prueba expirado');
      }
    }
    
    req.tenantId = req.user.tenantId;
    req.tenant = tenant;
    
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = tenantMiddleware;
