/**
 * Environment Configuration
 * Carga las variables de entorno desde .env
 */
require('dotenv').config();

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3000,

  // Database
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    name: process.env.DB_NAME || 'invleo_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // Frontend
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Redis (optional)
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    ttl: parseInt(process.env.REDIS_TTL) || 300, // Default cache TTL in seconds (5 minutes)
  },

  // SaaS Plans Limits
  plans: {
    free: {
      maxUsers: parseInt(process.env.PLAN_FREE_MAX_USERS) || 2,
      maxProducts: parseInt(process.env.PLAN_FREE_MAX_PRODUCTS) || 50,
      maxCashRegisters: parseInt(process.env.PLAN_FREE_MAX_CASH_REGISTERS) || 1,
    },
    basic: {
      maxUsers: parseInt(process.env.PLAN_BASIC_MAX_USERS) || 5,
      maxProducts: parseInt(process.env.PLAN_BASIC_MAX_PRODUCTS) || 500,
      maxCashRegisters: parseInt(process.env.PLAN_BASIC_MAX_CASH_REGISTERS) || 2,
    },
    pro: {
      maxUsers: parseInt(process.env.PLAN_PRO_MAX_USERS) || 10,
      maxProducts: parseInt(process.env.PLAN_PRO_MAX_PRODUCTS) || 5000,
      maxCashRegisters: parseInt(process.env.PLAN_PRO_MAX_CASH_REGISTERS) || 5,
    },
    enterprise: {
      maxUsers: parseInt(process.env.PLAN_ENTERPRISE_MAX_USERS) || 9999,
      maxProducts: parseInt(process.env.PLAN_ENTERPRISE_MAX_PRODUCTS) || 99999,
      maxCashRegisters: parseInt(process.env.PLAN_ENTERPRISE_MAX_CASH_REGISTERS) || 999,
    }
  },

  // Billing and payments
  billing: {
    gracePeriodDays: parseInt(process.env.BILLING_GRACE_PERIOD_DAYS) || 5,
    prices: {
      basic: parseInt(process.env.BILLING_PRICE_BASIC_CENTS) || 4900000,
      pro: parseInt(process.env.BILLING_PRICE_PRO_CENTS) || 9900000,
      enterprise: parseInt(process.env.BILLING_PRICE_ENTERPRISE_CENTS) || 19900000,
    },
    cycleDays: {
      basic: parseInt(process.env.BILLING_CYCLE_BASIC_DAYS) || 30,
      pro: parseInt(process.env.BILLING_CYCLE_PRO_DAYS) || 30,
      enterprise: parseInt(process.env.BILLING_CYCLE_ENTERPRISE_DAYS) || 30,
    },
  },

  wompi: {
    baseUrl: process.env.WOMPI_BASE_URL || 'https://production.wompi.co',
    publicKey: process.env.WOMPI_PUBLIC_KEY || '',
    privateKey: process.env.WOMPI_PRIVATE_KEY || '',
    integritySecret: process.env.WOMPI_INTEGRITY_SECRET || '',
    eventsSecret: process.env.WOMPI_EVENTS_SECRET || '',
    redirectUrl: process.env.WOMPI_REDIRECT_URL || 'http://localhost:5173/billing/checkout-result',
    enablePaymentLinks: process.env.WOMPI_ENABLE_PAYMENT_LINKS === 'true',
    skipWebhookSignatureValidation: process.env.WOMPI_SKIP_WEBHOOK_SIGNATURE_VALIDATION === 'true',
  },
};
