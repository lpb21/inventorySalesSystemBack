/**
 * Cash Register Routes
 * /v1/cash-registers
 */
const express = require('express');
const router = express.Router();
const cashRegisterController = require('../../controllers/cashRegisterController');
const authMiddleware = require('../../middlewares/authMiddleware');
const tenantMiddleware = require('../../middlewares/tenantMiddleware');
const { permissionMiddleware } = require('../../middlewares/permissionMiddleware');
const { validate } = require('../../middlewares/validationMiddleware');
const { writeOperationsLimiter } = require('../../middlewares/rateLimitMiddleware');
const Joi = require('joi');

// Validation schemas
const openShiftSchema = Joi.object({
  name: Joi.string().min(3).max(100).optional(),
  opening_amount: Joi.number().min(0).required().messages({
    'any.required': 'El monto de apertura es requerido',
    'number.min': 'El monto de apertura no puede ser negativo'
  }),
  notes: Joi.string().max(500).optional()
});

const closeShiftSchema = Joi.object({
  closing_amount: Joi.number().min(0).required().messages({
    'any.required': 'El monto de cierre es requerido',
    'number.min': 'El monto de cierre no puede ser negativo'
  }),
  notes: Joi.string().max(500).optional()
});

// All routes require authentication and tenant context
router.use(authMiddleware);
router.use(tenantMiddleware);

// GET /v1/cash-registers - List shifts (owners/managers see all, cashiers see own)
router.get('/',
  permissionMiddleware('cash-registers:read'),
  cashRegisterController.getShifts
);

// POST /v1/cash-registers/open - Open new shift
router.post('/open',
  writeOperationsLimiter,
  permissionMiddleware('cash-registers:open'),
  validate(openShiftSchema),
  cashRegisterController.openShift
);

// GET /v1/cash-registers/active - Get active shifts
router.get('/active',
  permissionMiddleware('cash-registers:read'),
  cashRegisterController.getActiveShifts
);

// GET /v1/cash-registers/my-active - Get current user's active shift
router.get('/my-active',
  permissionMiddleware('cash-registers:read'),
  cashRegisterController.getMyActiveShift
);

// GET /v1/cash-registers/:id - Get specific shift
router.get('/:id',
  permissionMiddleware('cash-registers:read'),
  cashRegisterController.getShiftById
);

// POST /v1/cash-registers/:id/close - Close shift
router.post('/:id/close',
  writeOperationsLimiter,
  permissionMiddleware('cash-registers:close'),
  validate(closeShiftSchema),
  cashRegisterController.closeShift
);

// GET /v1/cash-registers/:id/sales - Get shifts sales
router.get('/:id/sales',
  permissionMiddleware('sales:read'),
  cashRegisterController.getShiftSales
);

module.exports = router;