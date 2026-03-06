/**
 * Category Controller
 * Handles category endpoints
 */
const categoryService = require('../services/categoryService');
const { asyncHandler, formatResponse } = require('../utils/helpers');

class CategoryController {
  /**
   * GET /v1/categories
   * List all categories
   */
  getCategories = asyncHandler(async (req, res, next) => {
    const { page = 1, limit = 20, include_inactive } = req.query;

    // include_inactive=true → only inactive (is_active='false'), otherwise only active
    const is_active = include_inactive === 'true' ? 'false' : 'true';

    const result = await categoryService.getCategories(req.tenantId, { page, limit, is_active });
    
    res.status(200).json(formatResponse(result));
  });

  /**
   * POST /v1/categories
   * Create category
   */
  createCategory = asyncHandler(async (req, res, next) => {
    const category = await categoryService.createCategory(req.tenantId, req.body);
    
    res.status(201).json(formatResponse(category));
  });

  /**
   * GET /v1/categories/:id
   * Get category by ID
   */
  getCategoryById = asyncHandler(async (req, res, next) => {
    const category = await categoryService.getCategoryById(req.tenantId, req.params.id);
    
    res.status(200).json(formatResponse(category));
  });

  /**
   * PUT /v1/categories/:id
   * Update category
   */
  updateCategory = asyncHandler(async (req, res, next) => {
    const category = await categoryService.updateCategory(req.tenantId, req.params.id, req.body);
    
    res.status(200).json(formatResponse(category));
  });

  /**
   * DELETE /v1/categories/:id
   * Delete category
   */
  deleteCategory = asyncHandler(async (req, res, next) => {
    const result = await categoryService.deleteCategory(req.tenantId, req.params.id);
    
    res.status(200).json(formatResponse(result));
  });
}

module.exports = new CategoryController();
