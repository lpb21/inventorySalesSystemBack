/**
 * Customer Payment Service
 * Handles customer credit payments (abonos) and balance management
 */
const { Customer, Sale, sequelize } = require('../models');
const { NotFoundError, ValidationError } = require('../utils/errors');
const cacheService = require('./cacheService');
const logger = require('../utils/logger');

function withCacheMeta(result, meta, includeMeta) {
  if (!includeMeta) {
    return result;
  }

  return {
    data: result,
    meta,
  };
}

class CustomerPaymentService {
  /**
   * Register a customer payment (abono)
   */
  async registerPayment(tenantId, customerId, paymentData, userId) {
    const transaction = await sequelize.transaction();

    try {
      // Find customer
      const customer = await Customer.findOne({
        where: { id: customerId, tenant_id: tenantId },
      });

      if (!customer) {
        throw new NotFoundError('Cliente no encontrado');
      }

      const amount = parseFloat(paymentData.amount);
      if (amount <= 0) {
        throw new ValidationError('El monto del abono debe ser mayor a 0');
      }

      const currentBalance = parseFloat(customer.credit_balance);
      
      // Check if payment exceeds balance
      if (amount > currentBalance) {
        throw new ValidationError(
          `El abono (${amount}) no puede exceder el saldo actual (${currentBalance})`
        );
      }

      // Calculate new balance
      const newBalance = currentBalance - amount;

      // Update customer credit balance
      await customer.update({ credit_balance: newBalance }, { transaction });

      // TODO: Create payment record in a new CustomerPayment model if needed
      // For now, we'll just update the balance

      await transaction.commit();

      // Invalidate cache for this customer's balance and credit sales
      await cacheService.invalidateKeys([
        cacheService.getCustomerBalanceKey(tenantId, customerId),
      ]);
      await cacheService.invalidate(
        cacheService.getCustomerCreditSalesPattern(tenantId, customerId)
      );
      await cacheService.invalidate(
        cacheService.getCustomersWithCreditPattern(tenantId)
      );

      return {
        customer_id: customer.id,
        customer_name: customer.name,
        previous_balance: currentBalance,
        payment_amount: amount,
        new_balance: newBalance,
        payment_date: new Date(),
        note: paymentData.note || null,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get customer balance and credit information
   * Uses cache to avoid repeated database queries
   */
  async getCustomerBalance(tenantId, customerId, options = {}) {
    const { includeMeta = false } = options;
    // Generate cache key
    const cacheKey = cacheService.getCustomerBalanceKey(tenantId, customerId);

    // Try to get from cache first
    const cached = await cacheService.getWithMeta(cacheKey);
    if (cached.hit) {
      logger.info('customer-balance', 'Resolved from Redis', { tenantId, customerId });
      return withCacheMeta(cached.value, { cache: 'HIT', source: 'redis' }, includeMeta);
    }

    // Cache miss - query database
    const customer = await Customer.findOne({
      where: { id: customerId, tenant_id: tenantId },
      attributes: ['id', 'name', 'document', 'credit_balance', 'credit_limit', 'is_active'],
    });

    if (!customer) {
      throw new NotFoundError('Cliente no encontrado');
    }

    const creditBalance = parseFloat(customer.credit_balance);
    const creditLimit = parseFloat(customer.credit_limit);
    const availableCredit = creditLimit > 0 ? creditLimit - creditBalance : null;

    const result = {
      customer_id: customer.id,
      customer_name: customer.name,
      document: customer.document,
      credit_balance: creditBalance,
      credit_limit: creditLimit,
      available_credit: availableCredit,
      is_active: customer.is_active,
    };

    // Save to cache for future requests
    await cacheService.set(cacheKey, result);
    logger.info('customer-balance', 'Resolved from database and stored in Redis', { tenantId, customerId });

    return withCacheMeta(result, { cache: 'MISS', source: 'database' }, includeMeta);
  }

  /**
   * Get customer credit sales (sales with payment_method = 'credit')
   * Uses cache to avoid repeated database queries
   */
  async getCustomerCreditSales(tenantId, customerId, { page = 1, limit = 20, includeMeta = false } = {}) {
    const { getPaginationSkip, formatPagination } = require('../utils/helpers');

    // Generate cache key
    const cacheKey = cacheService.getCustomerCreditSalesKey(tenantId, customerId, page, limit);

    // Try to get from cache first
    const cached = await cacheService.getWithMeta(cacheKey);
    if (cached.hit) {
      logger.info('customer-credit-sales', 'Resolved from Redis', { tenantId, customerId, page, limit });
      return withCacheMeta(cached.value, { cache: 'HIT', source: 'redis' }, includeMeta);
    }

    // Cache miss - query database
    // Verify customer exists
    const customer = await Customer.findOne({
      where: { id: customerId, tenant_id: tenantId },
      attributes: ['id', 'name', 'credit_balance'],
    });

    if (!customer) {
      throw new NotFoundError('Cliente no encontrado');
    }

    const { count, rows } = await Sale.findAndCountAll({
      where: {
        tenant_id: tenantId,
        customer_id: customerId,
        payment_method: 'credit',
        status: 'completed',
      },
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: getPaginationSkip(page, limit),
    });

    const result = {
      customer_id: customer.id,
      customer_name: customer.name,
      current_balance: parseFloat(customer.credit_balance),
      sales: rows,
      pagination: formatPagination(page, limit, count),
    };

    // Save to cache for future requests
    await cacheService.set(cacheKey, result);
    logger.info('customer-credit-sales', 'Resolved from database and stored in Redis', {
      tenantId,
      customerId,
      page,
      limit,
    });

    return withCacheMeta(result, { cache: 'MISS', source: 'database' }, includeMeta);
  }

  /**
   * Get all customers with credit balance (debtors)
   */
  async getCustomersWithCredit(tenantId, { page = 1, limit = 20 } = {}) {
    const { getPaginationSkip, formatPagination } = require('../utils/helpers');
    
    // Generate cache key
    const cacheKey = cacheService.getCustomersWithCreditKey(tenantId, page, limit);

    // Try to get from cache first
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    const { count, rows } = await Customer.findAndCountAll({
      where: {
        tenant_id: tenantId,
        credit_balance: { [require('sequelize').Op.gt]: 0 },
      },
      attributes: ['id', 'name', 'document', 'phone', 'credit_balance', 'credit_limit'],
      order: [['credit_balance', 'DESC']],
      limit: parseInt(limit),
      offset: getPaginationSkip(page, limit),
    });

    const result = {
      customers: rows.map(customer => ({
        id: customer.id,
        name: customer.name,
        document: customer.document,
        phone: customer.phone,
        credit_balance: parseFloat(customer.credit_balance),
        credit_limit: parseFloat(customer.credit_limit),
      })),
      pagination: formatPagination(page, limit, count),
    };

    // Save to cache
    await cacheService.set(cacheKey, result);

    return result;
  }

  /**
   * Update customer credit limit
   */
  async updateCreditLimit(tenantId, customerId, creditLimit) {
    const customer = await Customer.findOne({
      where: { id: customerId, tenant_id: tenantId },
    });

    if (!customer) {
      throw new NotFoundError('Cliente no encontrado');
    }

    const newLimit = parseFloat(creditLimit);
    if (newLimit < 0) {
      throw new ValidationError('El límite de crédito no puede ser negativo');
    }

    await customer.update({ credit_limit: newLimit });

    // Invalidate cache for this customer's balance
    await cacheService.invalidateKeys([
      cacheService.getCustomerBalanceKey(tenantId, customerId),
    ]);

    return {
      customer_id: customer.id,
      customer_name: customer.name,
      credit_limit: newLimit,
      credit_balance: parseFloat(customer.credit_balance),
    };
  }
}

module.exports = new CustomerPaymentService();
