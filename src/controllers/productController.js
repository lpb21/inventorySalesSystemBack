/**
 * Product Controller
 * Handles product endpoints
 */
const productService = require('../services/productService');
const { asyncHandler, formatResponse } = require('../utils/helpers');

class ProductController {
  /**
   * GET /v1/products
   * List all products
   */
  getProducts = asyncHandler(async (req, res, next) => {
    const result = await productService.getProducts(req.tenantId, req.query);
    
    res.status(200).json(formatResponse(result));
  });

  /**
   * POST /v1/products
   * Create product
   */
  createProduct = asyncHandler(async (req, res, next) => {
    const product = await productService.createProduct(req.tenantId, req.body, req.user.id);
    
    res.status(201).json(formatResponse(product));
  });

  /**
   * GET /v1/products/:id
   * Get product by ID
   */
  getProductById = asyncHandler(async (req, res, next) => {
    const product = await productService.getProductById(req.tenantId, req.params.id);
    
    res.status(200).json(formatResponse(product));
  });

  /**
   * PUT /v1/products/:id
   * Update product
   */
  updateProduct = asyncHandler(async (req, res, next) => {
    const product = await productService.updateProduct(req.tenantId, req.params.id, req.body, req.user.id);
    
    res.status(200).json(formatResponse(product));
  });

  /**
   * DELETE /v1/products/:id
   * Delete product
   */
  deleteProduct = asyncHandler(async (req, res, next) => {
    const result = await productService.deleteProduct(req.tenantId, req.params.id, req.user.id);
    
    res.status(200).json(formatResponse(result));
  });

  /**
   * GET /v1/products/low-stock
   * Get low stock products
   */
  getLowStock = asyncHandler(async (req, res, next) => {
    const products = await productService.getLowStockProducts(req.tenantId);
    
    res.status(200).json(formatResponse(products));
  });

  /**
   * GET /v1/products/barcode/:code
   * Get product by barcode
   */
  getProductByBarcode = asyncHandler(async (req, res, next) => {
    const product = await productService.getProductByBarcode(req.tenantId, req.params.code);
    
    res.status(200).json(formatResponse(product));
  });

  /**
   * GET /v1/products/search
   * Search products
   */
  searchProducts = asyncHandler(async (req, res, next) => {
    const { q, limit } = req.query;
    const products = await productService.searchProducts(req.tenantId, q, limit);
    
    res.status(200).json(formatResponse(products));
  });
}

module.exports = new ProductController();
