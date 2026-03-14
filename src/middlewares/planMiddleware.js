/**
 * Plan Middleware
 * Validates if a tenant's plan allows access to certain features.
 */
const plansConfig = require('../config/plans');
const { AuthorizationError } = require('../utils/errors');

/**
 * Middleware to check if a tenant has access to a specific feature based on their plan.
 * @param {string} featureName - The name of the feature from plans.js (e.g., 'advancedReports')
 */
const requireFeature = (featureName) => {
    return (req, res, next) => {
        try {
            // Superadmin bypasses plan limits
            if (req.user && (req.user.isSuperadmin || req.user.role === 'superadmin')) {
                return next();
            }

            const tenantPlan = req.tenant?.plan; // 'free', 'basic', 'pro', etc.

            if (!tenantPlan) {
                throw new AuthorizationError('Plan de suscripción no encontrado para esta empresa.');
            }

            const planLimits = plansConfig[tenantPlan];

            if (!planLimits) {
                throw new AuthorizationError(`Plan '${tenantPlan}' no reconocido.`);
            }

            if (!planLimits.features[featureName]) {
                throw new AuthorizationError('Esta función requiere mejorar tu plan actual.');
            }

            next();
        } catch (error) {
            next(error);
        }
    };
};

module.exports = {
    requireFeature,
};
