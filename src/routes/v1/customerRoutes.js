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
const logger = require('../../utils/logger');
const { Op } = require('sequelize');

// All routes require authentication and tenant
router.use(authMiddleware);
router.use(tenantMiddleware);

// Get all customers
router.get('/', permissionMiddleware('customers:read'), async (req, res, next) => {
  try {
    const tenantId = req.tenant?.id;
    const { page = 1, limit = 20, search, is_active } = req.query;

    const where = { tenant_id: tenantId };
    if (search) {
      where.name = { [require('sequelize').Op.iLike]: `%${search}%` };
    }

    // Optional filter by active status: ?is_active=true|false
    if (is_active !== undefined) {
      if (is_active === 'true') {
        where.is_active = true;
      } else if (is_active === 'false') {
        where.is_active = false;
      } else {
        throw new ValidationError('El parámetro is_active debe ser true o false');
      }
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
    // Soporte para cuerpos anidados { data: { ... } } enviados por algunas librerías
    const payload = (req.body && req.body.data && typeof req.body.data === 'object' && !Array.isArray(req.body.data))
      ? req.body.data
      : req.body;

    const { id, name, document, email, phone, address, credit_limit } = payload;
    const normalizedDocument = typeof document === 'string' ? document.trim() : document;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : email;

    // Si viene un ID en el cuerpo de un POST, el usuario probablemente está intentando editar
    // pero su frontend está llamando a la ruta equivocada o no detectó el ID en el envoltorio.
    if (id || payload.id || req.body?.id) {
      console.log('[DEBUG CUSTOMERS] POST recibido con ID. Intentando redirigir o actualizar...');
      // Podríamos arrojar un error para que el usuario corrija su frontend,
      // o simplemente buscar y actualizar para ser "misericordiosos".
      // Por ahora, arrojamos error descriptivo.
      throw new ValidationError('Se recibió un ID en una petición de creación. Use PUT para actualizaciones.');
    }

    if (!name && !payload.name) {
      throw new ValidationError('El nombre del cliente es requerido');
    }

    if (normalizedDocument) {
      const existingCustomerByDocument = await Customer.findOne({
        where: {
          tenant_id: tenantId,
          document: normalizedDocument,
        },
      });

      if (existingCustomerByDocument) {
        throw new ValidationError('Ya existe un cliente con este documento. Use PUT para actualizarlo.');
      }
    }

    if (normalizedEmail) {
      const existingCustomerByEmail = await Customer.findOne({
        where: {
          tenant_id: tenantId,
          email: normalizedEmail,
        },
      });

      if (existingCustomerByEmail) {
        throw new ValidationError('Ya existe un cliente con este email. Use PUT para actualizarlo.');
      }
    }

    const customer = await Customer.create({
      tenant_id: tenantId,
      name,
      document: normalizedDocument || null,
      email: normalizedEmail || null,
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

    const payload = (req.body && req.body.data && typeof req.body.data === 'object' && !Array.isArray(req.body.data))
      ? req.body.data
      : req.body;

    const { name, document, email, phone, address, credit_limit, is_active } = payload;
    const normalizedDocument = typeof document === 'string' ? document.trim() : document;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : email;

    if (normalizedDocument !== undefined && normalizedDocument !== customer.document) {
      const existingCustomerByDocument = await Customer.findOne({
        where: {
          tenant_id: tenantId,
          document: normalizedDocument,
          id: { [Op.ne]: customer.id },
        },
      });

      if (existingCustomerByDocument) {
        throw new ValidationError('Ya existe otro cliente con este documento');
      }
    }

    if (normalizedEmail !== undefined && normalizedEmail !== (customer.email ? customer.email.toLowerCase() : customer.email)) {
      const existingCustomerByEmail = await Customer.findOne({
        where: {
          tenant_id: tenantId,
          email: normalizedEmail,
          id: { [Op.ne]: customer.id },
        },
      });

      if (existingCustomerByEmail) {
        throw new ValidationError('Ya existe otro cliente con este email');
      }
    }

    await customer.update({
      name: name || customer.name,
      document: document !== undefined ? normalizedDocument : customer.document,
      email: email !== undefined ? normalizedEmail : customer.email,
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
  const startedAt = Date.now();
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      throw new ValidationError('Tenant no encontrado');
    }

    const result = await customerPaymentService.getCustomerBalance(
      tenantId,
      req.params.id,
      { includeMeta: true }
    );

    res.set('X-Cache', result.meta.cache);
    logger.info('http', 'Customer balance served', {
      path: req.originalUrl,
      tenantId,
      customerId: req.params.id,
      source: result.meta.source,
      cache: result.meta.cache,
      durationMs: Date.now() - startedAt,
    });

    res.status(200).json({
      success: true,
      data: result.data,
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
  const startedAt = Date.now();
  try {
    const tenantId = req.tenant?.id;
    if (!tenantId) {
      throw new ValidationError('Tenant no encontrado');
    }

    const { page = 1, limit = 20 } = req.query;

    const result = await customerPaymentService.getCustomerCreditSales(
      tenantId,
      req.params.id,
      { page: parseInt(page), limit: parseInt(limit), includeMeta: true }
    );

    res.set('X-Cache', result.meta.cache);
    logger.info('http', 'Customer credit sales served', {
      path: req.originalUrl,
      tenantId,
      customerId: req.params.id,
      source: result.meta.source,
      cache: result.meta.cache,
      page: parseInt(page),
      limit: parseInt(limit),
      durationMs: Date.now() - startedAt,
    });

    res.status(200).json({
      success: true,
      data: result.data,
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
