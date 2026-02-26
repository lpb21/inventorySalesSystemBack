/**
 * Tenant Controller
 * Handles tenant endpoints
 */
const { Tenant, User } = require('../models');
const { asyncHandler, formatResponse } = require('../utils/helpers');
const { Op } = require('sequelize');

class TenantController {
  /**
   * GET /v1/tenants
   * List all tenants (admin only)
   */
  getTenants = asyncHandler(async (req, res, next) => {
    const tenants = await Tenant.findAll({
      attributes: { exclude: ['created_at', 'updated_at'] }
    });
    
    res.status(200).json(formatResponse(tenants));
  });

  /**
   * GET /v1/tenants/:id
   * Get tenant by ID
   */
  getTenantById = asyncHandler(async (req, res, next) => {
    const tenant = await Tenant.findByPk(req.params.id);
    
    if (!tenant) {
      return res.status(404).json(formatResponse(null, 'Tenant not found'));
    }
    
    res.status(200).json(formatResponse(tenant));
  });

  /**
   * PUT /v1/tenants/:id
   * Update tenant
   */
  updateTenant = asyncHandler(async (req, res, next) => {
    const tenant = await Tenant.findByPk(req.params.id);
    
    if (!tenant) {
      return res.status(404).json(formatResponse(null, 'Tenant not found'));
    }
    
    await tenant.update(req.body);
    
    res.status(200).json(formatResponse(tenant));
  });

  /**
   * DELETE /v1/tenants/:id
   * Delete tenant (soft delete)
   */
  deleteTenant = asyncHandler(async (req, res, next) => {
    const tenant = await Tenant.findByPk(req.params.id);
    
    if (!tenant) {
      return res.status(404).json(formatResponse(null, 'Tenant not found'));
    }
    
    await tenant.update({ is_active: false });
    
    res.status(200).json(formatResponse({ message: 'Tenant deleted successfully' }));
  });
}

module.exports = new TenantController();
