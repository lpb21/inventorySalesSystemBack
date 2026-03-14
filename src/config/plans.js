/**
 * Subscription Plans Configuration
 * Defines limits and features for each SaaS tier.
 * Cuantitative limits are loaded from environment variables via env.js.
 */
const env = require('./env');

const plans = {
    free: {
        maxUsers: env.plans.free.maxUsers,
        maxProducts: env.plans.free.maxProducts,
        maxCashRegisters: env.plans.free.maxCashRegisters,
        features: {
            advancedReports: false,
            apiAccess: false,
            prioritySupport: false,
        }
    },
    basic: {
        maxUsers: env.plans.basic.maxUsers,
        maxProducts: env.plans.basic.maxProducts,
        maxCashRegisters: env.plans.basic.maxCashRegisters,
        features: {
            advancedReports: false,
            apiAccess: false,
            prioritySupport: false,
        }
    },
    pro: {
        maxUsers: env.plans.pro.maxUsers,
        maxProducts: env.plans.pro.maxProducts,
        maxCashRegisters: env.plans.pro.maxCashRegisters,
        features: {
            advancedReports: true,
            apiAccess: false,
            prioritySupport: true,
        }
    },
    enterprise: {
        maxUsers: env.plans.enterprise.maxUsers,
        maxProducts: env.plans.enterprise.maxProducts,
        maxCashRegisters: env.plans.enterprise.maxCashRegisters,
        features: {
            advancedReports: true,
            apiAccess: true,
            prioritySupport: true,
        }
    }
};

module.exports = plans;
