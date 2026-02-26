/**
 * Tenant Middleware
 * Validates and sets tenant context for the request
 */
const { Tenant } = require('../models');
const { AuthenticationError } = require('../utils/errors');

const tenantMiddleware = async (req, res, next) => {
  try {
    // For regular users (owner, admin, supervisor, cashier, viewer), always use their assigned tenant
    if (!req.user.isSuperadmin && req.user.role !== 'superadmin') {
      if (!req.user.tenantId) {
        throw new AuthenticationError('No se encontró el tenant del usuario');
      }
      req.tenantId = req.user.tenantId;
      
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
      
      req.tenant = tenant;
      return next();
    }
    
    // For superadmin users, use their own tenant (or null if they don't have one)
    // Superadmin should NOT be able to see other tenants' data
    if (req.user.isSuperadmin || req.user.role === 'superadmin') {
      // Use superadmin's own tenant if they have one, otherwise null
      req.tenantId = req.user.tenantId;
      
      // If superadmin has a tenant, verify it's active
      if (req.tenantId) {
        const tenant = await Tenant.findByPk(req.tenantId);
        if (tenant && tenant.is_active) {
          req.tenant = tenant;
        }
      }
      
      return next();
    }
    
    // This should never be reached, but just in case
    throw new AuthenticationError('Tipo de usuario no reconocido');
  } catch (error) {
    next(error);
  }
};

module.exports = tenantMiddleware;
