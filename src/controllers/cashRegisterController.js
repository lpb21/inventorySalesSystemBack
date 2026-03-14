/**
 * Cash Register Controller
 * Handles cash register endpoints for shift management
 */
const cashRegisterService = require('../services/cashRegisterService');
const limitService = require('../services/limitService');
const { asyncHandler, formatResponse } = require('../utils/helpers');

class CashRegisterController {
  /**
   * POST /v1/cash-registers/open
   * Open a new cash register shift
   */
  openShift = asyncHandler(async (req, res, next) => {
    // Check SaaS plan limit for concurrent open cash registers
    if (!req.user.isSuperadmin && req.user.role !== 'superadmin') {
      await limitService.checkResourceLimit(req.tenantId, req.tenant.plan, 'cashRegisters');
    }

    const result = await cashRegisterService.openShift(
      req.tenantId,
      req.body,
      req.user.id
    );

    res.status(201).json(formatResponse(result));
  });

  /**
   * POST /v1/cash-registers/:id/close
   * Close a cash register shift
   */
  closeShift = asyncHandler(async (req, res, next) => {
    const result = await cashRegisterService.closeShift(
      req.tenantId,
      req.params.id,
      req.body,
      req.user.id
    );

    res.status(200).json(formatResponse(result));
  });

  /**
   * GET /v1/cash-registers/:id
   * Get a specific cash register shift
   */
  getShiftById = asyncHandler(async (req, res, next) => {
    const result = await cashRegisterService.getShiftById(
      req.tenantId,
      req.params.id,
      req.user.id,
      req.user.role
    );

    res.status(200).json(formatResponse(result));
  });

  /**
   * GET /v1/cash-registers
   * List cash register shifts with filters
   */
  getShifts = asyncHandler(async (req, res, next) => {
    const result = await cashRegisterService.getShifts(
      req.tenantId,
      req.query,
      req.user.id,
      req.user.role
    );

    res.status(200).json(formatResponse(result));
  });

  /**
   * GET /v1/cash-registers/active
   * Get active cash register shifts
   */
  getActiveShifts = asyncHandler(async (req, res, next) => {
    // For cashiers, return only their active shift
    if (req.user.role === 'cashier') {
      const result = await cashRegisterService.getActiveShift(
        req.tenantId,
        req.user.id
      );

      return res.status(200).json(formatResponse(result ? [result] : []));
    }

    // For owners/managers, return all active shifts
    const result = await cashRegisterService.getActiveShifts(req.tenantId);
    res.status(200).json(formatResponse(result));
  });

  /**
   * GET /v1/cash-registers/my-active
   * Get current user's active shift
   */
  getMyActiveShift = asyncHandler(async (req, res, next) => {
    const result = await cashRegisterService.getActiveShift(
      req.tenantId,
      req.user.id
    );

    res.status(200).json(formatResponse(result));
  });

  /**
   * GET /v1/cash-registers/:id/sales
   * Get sales for a specific shift
   */
  getShiftSales = asyncHandler(async (req, res, next) => {
    // First verify the user can access this shift
    await cashRegisterService.getShiftById(
      req.tenantId,
      req.params.id,
      req.user.id,
      req.user.role
    );

    // Import Sale service to get sales with cash register filter
    const saleService = require('../services/saleService');
    const result = await saleService.getSalesByShift(
      req.tenantId,
      req.params.id,
      req.query
    );

    res.status(200).json(formatResponse(result));
  });
}

module.exports = new CashRegisterController();