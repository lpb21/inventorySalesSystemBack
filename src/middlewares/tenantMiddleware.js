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
  console.log('[TENANT CACHE DEBUG] Buscando tenant en cache:', tenantId);
  const cacheKey = getTenantCacheKey(tenantId);
  let tenantData = await cacheService.get(cacheKey);

  if (!tenantData) {
    console.log('[TENANT CACHE DEBUG] No encontrado en cache, buscando en BD...');
    const tenant = await Tenant.findByPk(tenantId);
    console.log('[TENANT CACHE DEBUG] Tenant encontrado en BD:', tenant ? 'SI' : 'NO');
    if (tenant) {
      tenantData = tenant.toJSON();
      cacheService.set(cacheKey, tenantData, TENANT_CACHE_TTL).catch(() => { });
    }
  } else {
    console.log('[TENANT CACHE DEBUG] Tenant encontrado en cache');
  }

  return tenantData;
};

const tenantMiddleware = async (req, res, next) => {
  try {
    console.log('[TENANT DEBUG] Verificando tenant para usuario:', req.user ? req.user.id : 'NO USER');
    console.log('[TENANT DEBUG] Usuario isSuperadmin:', req.user ? req.user.isSuperadmin : false);

    // For regular users (owner, admin, supervisor, cashier, viewer), always use their assigned tenant
    if (!req.user.isSuperadmin && req.user.role !== 'superadmin') {
      console.log('[TENANT DEBUG] Usuario regular, verificando tenantId...');
      if (!req.user.tenantId) {
        console.log('[TENANT DEBUG] ERROR: Usuario sin tenantId');
        throw new AuthenticationError('No se encontró el tenant del usuario');
      }
      req.tenantId = req.user.tenantId;
      console.log('[TENANT DEBUG] TenantId asignado:', req.tenantId);

      // Verify tenant exists and is active (using cache)
      console.log('[TENANT DEBUG] Buscando datos del tenant...');
      const tenantData = await getTenantCached(req.user.tenantId);
      console.log('[TENANT DEBUG] Tenant obtenido:', tenantData ? 'SI' : 'NO');

      if (!tenantData) {
        console.log('[TENANT DEBUG] ERROR: Tenant no encontrado');
        throw new AuthenticationError('Tenant no encontrado');
      }

      console.log('[TENANT DEBUG] Verificando si tenant está activo:', tenantData.is_active);
      if (!tenantData.is_active) {
        throw new AuthenticationError('La empresa está inactiva');
      }

      console.log('[TENANT DEBUG] Verificando estado de suscripción:', tenantData.subscription_status);
      // Check subscription status
      if (tenantData.subscription_status === 'suspended') {
        throw new AuthenticationError('Suscripción suspendida');
      }

      if (tenantData.subscription_status === 'cancelled') {
        throw new AuthenticationError('Suscripción cancelada');
      }

      // Check if plan or trial period has expired
      const expirationDate = tenantData.subscription_ends_at || tenantData.trial_ends_at;
      if (expirationDate) {
        const expiresAt = new Date(expirationDate);
        if (expiresAt < new Date()) {
          const day = String(expiresAt.getDate()).padStart(2, '0');
          const month = String(expiresAt.getMonth() + 1).padStart(2, '0');
          const year = expiresAt.getFullYear();
          const formattedDate = `${day}/${month}/${year}`;

          const planName = tenantData.plan.toUpperCase();
          const message = tenantData.plan === 'free'
            ? `Tu plan ${planName} (Periodo de Prueba) ha expirado el día ${formattedDate}`
            : `Tu plan ${planName} ha vencido el día ${formattedDate}. Por favor renueva tu suscripción.`;
          throw new AuthenticationError(message);
        }
      }
      // Attach plan limits
      const plansConfig = require('../config/plans');
      tenantData.limits = plansConfig[tenantData.plan] || plansConfig.free;

      req.tenant = tenantData;
      console.log('[TENANT DEBUG] Usuario regular verificado. Pasando al siguiente middleware...');
      return next();
    }

    // For superadmin users, use their own tenant (or null if they don't have one)
    // Superadmin should NOT be able to see other tenants' data
    if (req.user.isSuperadmin || req.user.role === 'superadmin') {
      console.log('[TENANT DEBUG] Usuario superadmin detectado');
      // Use superadmin's own tenant if they have one, otherwise null
      req.tenantId = req.user.tenantId;

      // If superadmin has a tenant, verify it's active (using cache)
      if (req.tenantId) {
        if (tenantData && tenantData.is_active) {
          const plansConfig = require('../config/plans');
          tenantData.limits = plansConfig[tenantData.plan] || plansConfig.free;
          req.tenant = tenantData;
        }
      }

      console.log('[TENANT DEBUG] Superadmin verificado. Pasando al siguiente middleware...');
      return next();
    }

    // This should never be reached, but just in case
    throw new AuthenticationError('Tipo de usuario no reconocido');
  } catch (error) {
    console.log('[TENANT DEBUG] ERROR:', error.message);
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
