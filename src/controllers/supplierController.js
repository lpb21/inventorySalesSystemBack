/**
 * Supplier Controller
 * Handles supplier endpoints
 */
const supplierService = require('../services/supplierService');
const { asyncHandler, formatResponse } = require('../utils/helpers');
const { validateSupplierData } = require('../utils/validators');

class SupplierController {
  /**
   * GET /v1/suppliers
   * List all suppliers
   */
  getSuppliers = asyncHandler(async (req, res, next) => {
    const { page = 1, limit = 20, include_inactive } = req.query;

    // include_inactive=true → only inactive (is_active='false'), otherwise only active
    const is_active = include_inactive === 'true' ? 'false' : 'true';

    const result = await supplierService.getSuppliers(req.tenantId, { page, limit, is_active });
    
    res.status(200).json(formatResponse(result));
  });

  /**
   * GET /v1/suppliers/select
   * Get suppliers for dropdown/select
   */
  getSuppliersForSelect = asyncHandler(async (req, res, next) => {
    const suppliers = await supplierService.getSuppliersForSelect(req.tenantId);
    
    res.status(200).json(formatResponse(suppliers));
  });

  /**
   * POST /v1/suppliers
   * Create supplier
   */
  createSupplier = asyncHandler(async (req, res, next) => {
    // Validate input data
    const validation = validateSupplierData(req.body);
    if (!validation.isValid) {
      return res.status(400).json(formatResponse(null, validation.errors));
    }

    const supplier = await supplierService.createSupplier(
      req.tenantId, 
      req.body, 
      req.user.id
    );
    
    res.status(201).json(formatResponse(supplier));
  });

  /**
   * GET /v1/suppliers/:id
   * Get supplier by ID
   */
  getSupplierById = asyncHandler(async (req, res, next) => {
    const supplier = await supplierService.getSupplierById(
      req.tenantId, 
      req.params.id
    );
    
    res.status(200).json(formatResponse(supplier));
  });

  /**
   * PUT /v1/suppliers/:id
   * Update supplier
   */
  updateSupplier = asyncHandler(async (req, res, next) => {
    // Validate input data
    const validation = validateSupplierData(req.body, false); // false for update
    if (!validation.isValid) {
      return res.status(400).json(formatResponse(null, validation.errors));
    }

    const supplier = await supplierService.updateSupplier(
      req.tenantId, 
      req.params.id, 
      req.body, 
      req.user.id
    );
    
    res.status(200).json(formatResponse(supplier));
  });

  /**
   * DELETE /v1/suppliers/:id
   * Delete supplier (soft delete)
   */
  deleteSupplier = asyncHandler(async (req, res, next) => {
    const result = await supplierService.deleteSupplier(
      req.tenantId, 
      req.params.id, 
      req.user.id
    );
    
    res.status(200).json(formatResponse(result));
  });

  /**
   * PATCH /v1/suppliers/:id/toggle-status
   * Toggle supplier status (active/inactive)
   */
  toggleSupplierStatus = asyncHandler(async (req, res, next) => {
    const supplier = await supplierService.toggleSupplierStatus(
      req.tenantId, 
      req.params.id, 
      req.user.id
    );
    
    res.status(200).json(formatResponse(supplier));
  });
}

module.exports = new SupplierController();