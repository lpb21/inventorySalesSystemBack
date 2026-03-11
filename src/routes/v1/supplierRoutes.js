/**
 * Supplier Routes
 * /v1/suppliers
 */
const express = require('express');
const router = express.Router();
const supplierController = require('../../controllers/supplierController');
const authMiddleware = require('../../middlewares/authMiddleware');
const tenantMiddleware = require('../../middlewares/tenantMiddleware');
const { permissionMiddleware } = require('../../middlewares/permissionMiddleware');
const { validate } = require('../../middlewares/validationMiddleware');
const { supplierSchema, updateSupplierSchema } = require('../../utils/validators');
const { writeOperationsLimiter } = require('../../middlewares/rateLimitMiddleware');

// All routes require authentication and tenant context
router.use(authMiddleware);
router.use(tenantMiddleware);

// GET /v1/suppliers - List suppliers
router.get('/', 
  permissionMiddleware('suppliers:read'), 
  supplierController.getSuppliers
);

// POST /v1/suppliers - Create supplier
router.post('/', 
  writeOperationsLimiter,
  permissionMiddleware('suppliers:create'), 
  validate(supplierSchema),
  supplierController.createSupplier
);

// GET /v1/suppliers/select - Get suppliers for dropdown
router.get('/select', 
  permissionMiddleware('suppliers:read'), 
  supplierController.getSuppliersForSelect
);

// GET /v1/suppliers/:id - Get supplier by ID
router.get('/:id', 
  permissionMiddleware('suppliers:read'), 
  supplierController.getSupplierById
);

// PATCH /v1/suppliers/:id/toggle-status - Toggle supplier status
router.patch('/:id/toggle-status', 
  writeOperationsLimiter,
  permissionMiddleware('suppliers:update'), 
  supplierController.toggleSupplierStatus
);

// PUT /v1/suppliers/:id - Update supplier
router.put('/:id', 
  writeOperationsLimiter,
  permissionMiddleware('suppliers:update'), 
  validate(updateSupplierSchema),
  supplierController.updateSupplier
);

// DELETE /v1/suppliers/:id - Delete supplier
router.delete('/:id', 
  writeOperationsLimiter,
  permissionMiddleware('suppliers:delete'), 
  supplierController.deleteSupplier
);

module.exports = router;
