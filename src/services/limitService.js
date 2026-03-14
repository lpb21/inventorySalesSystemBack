/**
 * Limit Service
 * Enforces quantitative limits based on the tenant's subscription plan.
 */
const { Product, User, CashRegister } = require('../models');
const plansConfig = require('../config/plans');
const { AuthorizationError } = require('../utils/errors');

/**
 * Checks if a tenant has reached their maximum allowed limit for a specific resource.
 * Throws an AuthorizationError if the limit is reached.
 * 
 * @param {string} tenantId - The UUID of the tenant
 * @param {string} tenantPlan - The plan string ('free', 'pro', etc.)
 * @param {string} resourceType - The type of resource ('users', 'products', 'cashRegisters')
 */
const checkResourceLimit = async (tenantId, tenantPlan, resourceType) => {
    const planLimits = plansConfig[tenantPlan];

    if (!planLimits) {
        throw new AuthorizationError(`Plan '${tenantPlan}' no reconocido.`);
    }

    let limit = 0;
    let currentCount = 0;
    let resourceName = '';

    switch (resourceType) {
        case 'users':
            limit = planLimits.maxUsers;
            // Exclude superadmins or inactive users if needed, for now count all active by tenant
            currentCount = await User.count({ where: { tenant_id: tenantId, is_active: true } });
            resourceName = 'usuarios activos';
            break;

        case 'products':
            limit = planLimits.maxProducts;
            currentCount = await Product.count({ where: { tenant_id: tenantId } });
            resourceName = 'productos';
            break;

        case 'cashRegisters':
            limit = planLimits.maxCashRegisters;
            // We only count concurrently "open" shifts as active cash registers
            currentCount = await CashRegister.count({ where: { tenant_id: tenantId, status: 'open' } });
            resourceName = 'cajas registradoras simultáneas';
            break;

        default:
            throw new Error(`Tipo de recurso desconocido para verificación de límites: ${resourceType}`);
    }

    if (currentCount >= limit) {
        throw new AuthorizationError(`Has alcanzado el límite de ${limit} ${resourceName} de tu plan ${tenantPlan.toUpperCase()}.`);
    }
};

module.exports = {
    checkResourceLimit,
};
