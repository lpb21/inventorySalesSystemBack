/**
 * Tenant Middleware
 * Validates and sets tenant context for the request
 * Uses Redis cache to avoid querying the DB on every request
 */
const { Tenant } = require('../models');
const { AuthenticationError } = require('../utils/errors');
const cacheService = require('../services/cacheService');

const TENANT_CACHE_TTL = 300; // 5 minutes

/**
 * Get cache key for a tenant
 */
const getTenantCacheKey = (tenantId) => `tenant:info:${tenantId}`;

/**
 * Get tenant from cache or DB
 */
const getTenantCached = async (tenantId) => {
  const cacheKey = getTenantCacheKey(tenantId);
  let tenantData = await cacheService.get(cacheKey);

  if (!tenantData) {
    const tenant = await Tenant.findByPk(tenantId);
    if (tenant) {
      tenantData = tenant.toJSON();
      cacheService.set(cacheKey, tenantData, TENANT_CACHE_TTL).catch(() => {});
    }
  }

  return tenantData;
};

const tenantMiddleware = async (req, res, next) => {
  try {
    // For regular users (owner, admin, supervisor, cashier, viewer), always use their assigned tenant
    if (!req.user.isSuperadmin && req.user.role !== 'superadmin') {
      if (!req.user.tenantId) {
        throw new AuthenticationError('No se encontró el tenant del usuario');
      }
      req.tenantId = req.user.tenantId;
      
      // Verify tenant exists and is active (using cache)
      const tenantData = await getTenantCached(req.user.tenantId);
      
      if (!tenantData) {
        throw new AuthenticationError('Tenant no encontrado');
      }
      
      if (!tenantData.is_active) {
        throw new AuthenticationError('La empresa está inactiva');
      }
      
      // Check subscription status
      if (tenantData.subscription_status === 'suspended') {
        throw new AuthenticationError('Suscripción suspendida');
      }
      
      if (tenantData.subscription_status === 'cancelled') {
        throw new AuthenticationError('Suscripción cancelada');
      }
      
      // Check if trial period has expired
      if (tenantData.subscription_status === 'trial' && tenantData.trial_ends_at) {
        const trialEnd = new Date(tenantData.trial_ends_at);
        if (trialEnd < new Date()) {
          throw new AuthenticationError('Período de prueba expirado');
        }
      }
      
      req.tenant = tenantData;
      return next();
    }
    
    // For superadmin users, use their own tenant (or null if they don't have one)
    // Superadmin should NOT be able to see other tenants' data
    if (req.user.isSuperadmin || req.user.role === 'superadmin') {
      // Use superadmin's own tenant if they have one, otherwise null
      req.tenantId = req.user.tenantId;
      
      // If superadmin has a tenant, verify it's active (using cache)
      if (req.tenantId) {
        const tenantData = await getTenantCached(req.tenantId);
        if (tenantData && tenantData.is_active) {
          req.tenant = tenantData;
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

/**
 * Invalidate a tenant's cache (call when tenant is updated)
 */
tenantMiddleware.invalidateTenantCache = async (tenantId) => {
  await cacheService.invalidateKeys([getTenantCacheKey(tenantId)]);
};

module.exports = tenantMiddleware;
