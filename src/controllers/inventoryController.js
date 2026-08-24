/**
 * Inventory Controller
 * Handles inventory endpoints
 */
const inventoryService = require('../services/inventoryService');
const { asyncHandler, formatResponse } = require('../utils/helpers');

class InventoryController {
  /**
   * GET /v1/inventory
   * Get inventory
   */
  getInventory = asyncHandler(async (req, res, next) => {
    const result = await inventoryService.getInventory(req.tenantId, req.query);
    
    res.status(200).json(formatResponse(result));
  });

  /**
   * POST /v1/inventory/adjust
   * Adjust inventory
   */
  adjustInventory = asyncHandler(async (req, res, next) => {
    const movement = await inventoryService.recordMovement(req.tenantId, {
      ...req.body,
      user_id: req.user.userId,
    });
    
    res.status(201).json(formatResponse(movement));
  });

  /**
   * GET /v1/inventory/movements
   * Get inventory movements
   */
  getMovements = asyncHandler(async (req, res, next) => {
    const result = await inventoryService.getMovements(req.tenantId, req.query);
    
    res.status(200).json(formatResponse(result));
  });

  /**
   * GET /v1/inventory/movements/:productId
   * Get movements for specific product
   */
  getProductMovements = asyncHandler(async (req, res, next) => {
    const result = await inventoryService.getProductMovements(req.tenantId, req.params.productId, req.query);
    
    res.status(200).json(formatResponse(result));
  });

  /**
   * POST /v1/inventory/bulk-adjust
   * Bulk adjust inventory
   */
  bulkAdjust = asyncHandler(async (req, res, next) => {
    const { adjustments } = req.body;
    const results = await inventoryService.bulkAdjustStock(req.tenantId, adjustments, req.user.userId);
    
    res.status(200).json(formatResponse({ results }));
  });

    /**
   * POST /v1/inventory/transform
   * Despiece: descuenta un producto origen e incrementa productos destino.
   */
  transform = asyncHandler(async (req, res) => {
    const result = await inventoryService.transform(
      req.tenantId,
      req.body,
      req.user.userId
    );
    res.status(200).json(formatResponse(result));
  });
}

module.exports = new InventoryController();
