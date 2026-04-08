/**
 * ePayco SDK Client Configuration
 * Centralizes all ePayco SDK initialization and provides utility methods
 */

const EpaycoSDK = require('epayco-sdk-node');
const env = require('./env');

/**
 * Initialize ePayco SDK
 */
const epaycoClient = new EpaycoSDK({
  apiKey: env.epayco.publicKey,
  privateKey: env.epayco.privateKey,
  lang: 'ES',
  test: env.epayco.testMode,
});

/**
 * Utility: Create payment reference
 */
const buildCheckoutReference = (tenantId, planCode) => {
  return `invleo-${tenantId}-${planCode}-${Date.now()}`;
};

/**
 * Utility: Build anonymous checkout reference
 */
const buildAnonymousCheckoutReference = (email, planCode) => {
  return `invleo-anon-${Buffer.from(email).toString('base64').slice(0, 8)}-${planCode}-${Date.now()}`;
};

/**
 * Create payment session using ePayco Bank API
 * This creates a payment reference that returns a checkout URL
 */
const createPaymentSession = async (paymentInfo) => {
  try {
    const response = await epaycoClient.bank.create(paymentInfo);
    return response;
  } catch (error) {
    console.error('[EPAYCO ERROR] Bank payment failed:', error);
    throw error;
  }
};

/**
 * Retrieve payment/transaction details
 */
const getTransaction = async (transactionId) => {
  try {
    const response = await epaycoClient.bank.get(transactionId);
    return response;
  } catch (error) {
    console.error('[EPAYCO ERROR] Get transaction failed:', error);
    throw error;
  }
};

/**
 * Create a customer in ePayco for future recurring payments
 */
const createCustomer = async (customerInfo) => {
  try {
    const response = await epaycoClient.customers.create(customerInfo);
    return response;
  } catch (error) {
    console.error('[EPAYCO ERROR] Create customer failed:', error);
    throw error;
  }
};

/**
 * Create a subscription for recurring billing
 */
const createSubscription = async (subscriptionInfo) => {
  try {
    const response = await epaycoClient.subscriptions.create(subscriptionInfo);
    return response;
  } catch (error) {
    console.error('[EPAYCO ERROR] Create subscription failed:', error);
    throw error;
  }
};

module.exports = {
  epaycoClient,
  buildCheckoutReference,
  buildAnonymousCheckoutReference,
  createPaymentSession,
  getTransaction,
  createCustomer,
  createSubscription,
};
