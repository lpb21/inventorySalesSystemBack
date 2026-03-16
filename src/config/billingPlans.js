/**
 * Billing plans catalog for payment providers.
 * Amounts are monthly values in COP cents.
 */
const env = require('./env');

module.exports = {
  basic: {
    code: 'basic',
    amountInCents: env.billing.prices.basic,
    currency: 'COP',
    cycleDays: env.billing.cycleDays.basic,
    displayName: 'Plan Basic',
  },
  pro: {
    code: 'pro',
    amountInCents: env.billing.prices.pro,
    currency: 'COP',
    cycleDays: env.billing.cycleDays.pro,
    displayName: 'Plan Pro',
  },
  enterprise: {
    code: 'enterprise',
    amountInCents: env.billing.prices.enterprise,
    currency: 'COP',
    cycleDays: env.billing.cycleDays.enterprise,
    displayName: 'Plan Enterprise',
  },
};
