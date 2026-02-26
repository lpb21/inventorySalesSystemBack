/**
 * Sale Controller
 * Handles sales endpoints
 */
const saleService = require('../services/saleService');
const { asyncHandler, formatResponse } = require('../utils/helpers');

class SaleController {
  /**
   * GET /v1/sales
   * List all sales
   */
  getSales = asyncHandler(async (req, res, next) => {
    const result = await saleService.getSales(req.tenantId, req.query);
    
    res.status(200).json(formatResponse(result));
  });

  /**
   * POST /v1/sales
   * Create new sale
   */
  createSale = asyncHandler(async (req, res, next) => {
    const sale = await saleService.createSale(req.tenantId, req.body, req.user.userId);
    
    res.status(201).json(formatResponse(sale));
  });

  /**
   * GET /v1/sales/:id
   * Get sale by ID
   */
  getSaleById = asyncHandler(async (req, res, next) => {
    const sale = await saleService.getSaleById(req.tenantId, req.params.id);
    
    res.status(200).json(formatResponse(sale));
  });

  /**
   * POST /v1/sales/:id/cancel
   * Cancel sale
   */
  cancelSale = asyncHandler(async (req, res, next) => {
    const { reason } = req.body;
    const sale = await saleService.cancelSale(req.tenantId, req.params.id, req.user.userId, reason);
    
    res.status(200).json(formatResponse(sale));
  });

  /**
   * GET /v1/sales/today
   * Get today's sales
   */
  getTodaySales = asyncHandler(async (req, res, next) => {
    const result = await saleService.getTodaySales(req.tenantId);
    
    res.status(200).json(formatResponse(result));
  });

  /**
   * GET /v1/sales/by-date
   * Get sales by date range
   */
  getSalesByDate = asyncHandler(async (req, res, next) => {
    const { start_date, end_date } = req.query;
    const result = await saleService.getSalesByDateRange(req.tenantId, start_date, end_date);
    
    res.status(200).json(formatResponse(result));
  });
}

module.exports = new SaleController();
