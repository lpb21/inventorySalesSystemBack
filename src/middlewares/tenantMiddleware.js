/**
 * Tenant Middleware
 * Validates and sets tenant context for the request
 * Uses Redis cache to avoid querying the DB on every request
 */
const { Tenant } = require('../models');
const { AuthenticationError } = require('../utils/errors');
const cacheService = require('../services/cacheService');
const plansConfig = require('../config/plans');

const TENANT_CACHE_TTL = 300; // 5 minutes

const getTenantCacheKey = (tenantId) => `tenant:info:${tenantId}`;

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
    const isSuperadmin = req.user.isSuperadmin || req.user.role === 'superadmin';

    // Usuarios regulares: siempre acotados a su tenant asignado
    if (!isSuperadmin) {
      if (!req.user.tenantId) {
        throw new AuthenticationError('No se encontró el tenant del usuario');
      }
      req.tenantId = req.user.tenantId;

      const tenantData = await getTenantCached(req.user.tenantId);
      if (!tenantData) {
        throw new AuthenticationError('Tenant no encontrado');
      }
      if (!tenantData.is_active) {
        throw new AuthenticationError('La empresa está inactiva');
      }
      if (tenantData.subscription_status === 'suspended') {
        throw new AuthenticationError('Suscripción suspendida');
      }
      if (tenantData.subscription_status === 'cancelled') {
        throw new AuthenticationError('Suscripción cancelada');
      }

      tenantData.limits = plansConfig[tenantData.plan] || plansConfig.free;
      req.tenant = tenantData;
      return next();
    }

    // Superadmin: acotado a su propio tenant si lo tiene (nunca datos de otros tenants)
    req.tenantId = req.user.tenantId || null;

    if (req.tenantId) {
      const tenantData = await getTenantCached(req.tenantId);
      if (tenantData && tenantData.is_active) {
        tenantData.limits = plansConfig[tenantData.plan] || plansConfig.free;
        req.tenant = tenantData;
      }
    }

    return next();
  } catch (error) {
    next(error);
  }
};

tenantMiddleware.invalidateTenantCache = async (tenantId) => {
  await cacheService.invalidateKeys([getTenantCacheKey(tenantId)]);
};

module.exports = tenantMiddleware;