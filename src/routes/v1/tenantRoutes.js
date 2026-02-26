/**
 * Tenant Routes
 * /v1/tenants
 */
const express = require('express');
const router = express.Router();
const tenantController = require('../../controllers/tenantController');
const authMiddleware = require('../../middlewares/authMiddleware');

// All routes require authentication
router.use(authMiddleware);

// GET /v1/tenants
router.get('/', tenantController.getTenants);

// GET /v1/tenants/:id
router.get('/:id', tenantController.getTenantById);

// PUT /v1/tenants/:id
router.put('/:id', tenantController.updateTenant);

// DELETE /v1/tenants/:id
router.delete('/:id', tenantController.deleteTenant);

module.exports = router;
