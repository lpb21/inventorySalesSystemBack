/**
 * Customer Routes
 * /v1/customers
 */
const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middlewares/authMiddleware');
const tenantMiddleware = require('../../middlewares/tenantMiddleware');
const { permissionMiddleware } = require('../../middlewares/permissionMiddleware');
const { validate } = require('../../middlewares/validationMiddleware');
const { Customer } = require('../../models');
const customerPaymentService = require('../../services/customerPaymentService');
const cacheService = require('../../services/cacheService');
const { ValidationError } = require('../../utils/errors');

// All routes require authentication and tenant
router.use(authMiddleware);
router.use(tenantMiddleware);

// Get all customers
router.get('/', permissionMiddleware('customers:read'), async (req, res, next) => {
  try {
    const tenantId = req.tenant?.id;
    const { page = 1, limit = 20, search } = req.query;
    
    const where = { tenant_id: tenantId };
    if (search) {
      where.name = { [require('sequelize').Op.iLike]: `%${search}%` };
    }

    const { count, rows } = await Customer.findAndCountAll({
      where,
      order: [['name', 'ASC']],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
    });

    res.status(200).json({
      success: true,
      data: {
        customers: rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// Create new customer
router.post('/', permissionMiddleware('customers:create'), async (req, res, next) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      throw new ValidationError('Tenant no encontrado');
    }

    const { name, document, email, phone, address, credit_limit } = req.body;
    
    if (!name) {
      throw new ValidationError('El nombre del cliente es requerido');
    }

    const customer = await Customer.create({
      tenant_id: tenantId,
      name,
      document: document || null,
      email: email || null,
      phone: phone || null,
      address: address || null,
      credit_limit: credit_limit ? parseFloat(credit_limit) : 0,
      credit_balance: 0,
      is_active: true,
    });

    res.status(201).json({
      success: true,
      message: 'Cliente creado exitosamente',
      data: customer,
    });
  } catch (error) {
    next(error);
  }
});

// Get customer by ID
router.get('/:id', permissionMiddleware('customers:read'), async (req, res, next) => {
  try {
    const tenantId = req.tenant?.id;
    const customer = await Customer.findOne({
      where: { id: req.params.id, tenant_id: tenantId },
    });

    if (!customer) {
      throw new ValidationError('Cliente no encontrado');
    }

    res.status(200).json({
      success: true,
      data: customer,
    });
  } catch (error) {
    next(error);
  }
});

// Update customer
router.put('/:id', permissionMiddleware('customers:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenant?.id;
    const customer = await Customer.findOne({
      where: { id: req.params.id, tenant_id: tenantId },
    });

    if (!customer) {
      throw new ValidationError('Cliente no encontrado');
    }

    const { name, document, email, phone, address, credit_limit, is_active } = req.body;
    
    await customer.update({
      name: name || customer.name,
      document: document !== undefined ? document : customer.document,
      email: email !== undefined ? email : customer.email,
      phone: phone !== undefined ? phone : customer.phone,
      address: address !== undefined ? address : customer.address,
      credit_limit: credit_limit !== undefined ? parseFloat(credit_limit) : customer.credit_limit,
      is_active: is_active !== undefined ? is_active : customer.is_active,
    });

    // Invalidate cache if credit limit or status changed
    if (credit_limit !== undefined || is_active !== undefined) {
      await cacheService.invalidateKeys([
        cacheService.getCustomerBalanceKey(tenantId, customer.id),
      ]);
      await cacheService.invalidate(
        cacheService.getCustomersWithCreditPattern(tenantId)
      );
    }

    res.status(200).json({
      success: true,
      message: 'Cliente actualizado exitosamente',
      data: customer,
    });
  } catch (error) {
    next(error);
  }
});

// Delete customer (soft delete by setting inactive)
router.delete('/:id', permissionMiddleware('customers:delete'), async (req, res, next) => {
  try {
    const tenantId = req.tenant?.id;
    const customer = await Customer.findOne({
      where: { id: req.params.id, tenant_id: tenantId },
    });

    if (!customer) {
      throw new ValidationError('Cliente no encontrado');
    }

    await customer.update({ is_active: false });

    // Invalidate cache
    await cacheService.invalidateKeys([
      cacheService.getCustomerBalanceKey(tenantId, customer.id),
    ]);
    await cacheService.invalidate(
      cacheService.getCustomersWithCreditPattern(tenantId)
    );

    res.status(200).json({
      success: true,
      message: 'Cliente eliminado exitosamente',
      data: { message: 'Cliente eliminado' },
    });
  } catch (error) {
    next(error);
  }
});


// Credit/Payment routes

/**
 * POST /:id/payments
 * Register a customer payment (abono)
 */
router.post('/:id/payments', async (req, res, next) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      throw new ValidationError('Tenant no encontrado');
    }

    const { amount, note } = req.body;
    
    if (!amount || parseFloat(amount) <= 0) {
      throw new ValidationError('El monto del abono es requerido y debe ser mayor a 0');
    }

    const result = await customerPaymentService.registerPayment(
      tenantId,
      req.params.id,
      { amount: parseFloat(amount), note },
      req.user.id
    );

    res.status(201).json({
      success: true,
      message: 'Abono registrado exitosamente',
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /:id/balance
 * Get customer credit balance
 */
router.get('/:id/balance', async (req, res, next) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      throw new ValidationError('Tenant no encontrado');
    }

    const result = await customerPaymentService.getCustomerBalance(
      tenantId,
      req.params.id
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /:id/credit-sales
 * Get customer credit sales history
 */
router.get('/:id/credit-sales', async (req, res, next) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      throw new ValidationError('Tenant no encontrado');
    }

    const { page = 1, limit = 20 } = req.query;

    const result = await customerPaymentService.getCustomerCreditSales(
      tenantId,
      req.params.id,
      { page: parseInt(page), limit: parseInt(limit) }
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /with-credit
 * Get all customers with credit balance (debtors)
 */
router.get('/with-credit/list', async (req, res, next) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      throw new ValidationError('Tenant no encontrado');
    }

    const { page = 1, limit = 20 } = req.query;

    const result = await customerPaymentService.getCustomersWithCredit(
      tenantId,
      { page: parseInt(page), limit: parseInt(limit) }
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /:id/credit-limit
 * Update customer credit limit
 */
router.put('/:id/credit-limit', async (req, res, next) => {
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      throw new ValidationError('Tenant no encontrado');
    }

    const { credit_limit } = req.body;
    
    if (credit_limit === undefined || credit_limit === null) {
      throw new ValidationError('El límite de crédito es requerido');
    }

    const result = await customerPaymentService.updateCreditLimit(
      tenantId,
      req.params.id,
      credit_limit
    );

    res.status(200).json({
      success: true,
      message: 'Límite de crédito actualizado exitosamente',
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
