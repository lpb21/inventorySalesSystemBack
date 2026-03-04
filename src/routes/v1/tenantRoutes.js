/**
 * Tenant Routes
 * /v1/tenants
 */
const express = require('express');
const router = express.Router();
const tenantController = require('../../controllers/tenantController');
const authMiddleware = require('../../middlewares/authMiddleware');
const tenantMiddleware = require('../../middlewares/tenantMiddleware');
const { roleMiddleware } = require('../../middlewares/permissionMiddleware');
const { validate } = require('../../middlewares/validationMiddleware');
const { createTenantSchema } = require('../../utils/validators');

// All routes require authentication
router.use(authMiddleware);

// POST /v1/tenants - Create new tenant (owner and superadmin)
// Validates required fields: name, slug, address, phone, plan, subscription_end_date, owner_name, owner_email, owner_password
router.post('/', roleMiddleware(['owner', 'superadmin']), validate(createTenantSchema), tenantController.createTenant);

// GET /v1/tenants - List all tenants (owner and superadmin)
router.get('/', roleMiddleware(['owner', 'superadmin']), tenantController.getTenants);

// GET /v1/tenants/:id - requires tenant context
router.get('/:id', tenantMiddleware, tenantController.getTenantById);

// PUT /v1/tenants/:id - requires tenant context
router.put('/:id', tenantMiddleware, tenantController.updateTenant);

// DELETE /v1/tenants/:id - requires tenant context
router.delete('/:id', roleMiddleware(['owner', 'superadmin']), tenantController.deleteTenant);

module.exports = router;
