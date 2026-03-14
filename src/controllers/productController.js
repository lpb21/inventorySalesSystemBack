/**
 * Product Controller
 * Handles product endpoints
 */
const productService = require('../services/productService');
const { asyncHandler, formatResponse } = require('../utils/helpers');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const limitService = require('../services/limitService');

// Event emitter for progress updates
const importProgress = new EventEmitter();

class ProductController {
  /**
   * GET /v1/products/import/progress/:importId
   * SSE endpoint for progress updates
   */
  getImportProgress = asyncHandler(async (req, res, next) => {
    const { importId } = req.params;
    console.log('[IMPORT DEBUG - SSE] Cliente conectado para seguimiento de importId:', importId);

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Send initial connection message
    const initialMessage = { status: 'connected', importId };
    console.log('[IMPORT DEBUG - SSE] Enviando mensaje inicial:', initialMessage);
    res.write(`data: ${JSON.stringify(initialMessage)}\n\n`);

    // Listen for progress updates
    const handleProgress = (data) => {
      if (data.importId === importId) {
        console.log('[IMPORT DEBUG - SSE] Enviando actualización al cliente:', data.status, data.progress + '%');
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      }
    };

    importProgress.on('progress', handleProgress);

    // Clean up on client disconnect
    req.on('close', () => {
      console.log('[IMPORT DEBUG - SSE] Cliente desconectado de importId:', importId);
      importProgress.removeListener('progress', handleProgress);
      res.end();
    });
  });

  /**
   * POST /v1/products/import
   * Bulk import products from CSV with SSE progress tracking
   */
  bulkImport = async (req, res, next) => {
    try {
      console.log('[IMPORT DEBUG] Nueva petición de importación recibida');
      console.log('[IMPORT DEBUG] Archivo:', req.file ? req.file.originalname : 'NO FILE');
      console.log('[IMPORT DEBUG] TenantId:', req.tenantId);
      console.log('[IMPORT DEBUG] UserId:', req.user ? req.user.id : 'NO USER');

      if (!req.file) {
        console.log('[IMPORT DEBUG] ERROR: No se proporcionó archivo');
        return res.status(400).json(formatResponse(null, 'No se ha proporcionado ningún archivo CSV'));
      }

      // Pre-check basic limit (though bulk import might go over, we at least check if they are already at limit)
      if (req.user && !req.user.isSuperadmin && req.user.role !== 'superadmin') {
        await limitService.checkResourceLimit(req.tenantId, req.tenant.plan, 'products');
      }

      const importId = Date.now().toString(36) + Math.random().toString(36).substr(2);
      console.log('[IMPORT DEBUG] ImportId generado:', importId);

      const results = [];

      // Parse CSV file
      console.log('[IMPORT DEBUG] Iniciando parsing del CSV...');
      await new Promise((resolve, reject) => {
        fs.createReadStream(req.file.path)
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', resolve)
          .on('error', reject);
      });
      console.log('[IMPORT DEBUG] CSV parseado. Total de filas:', results.length);

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      console.log('[IMPORT DEBUG] Archivo temporal eliminado');

      if (results.length === 0) {
        console.log('[IMPORT DEBUG] ERROR: CSV vacío');
        return res.status(400).json(formatResponse(null, 'El archivo CSV está vacío'));
      }

      // Set SSE headers
      console.log('[IMPORT DEBUG] Configurando respuesta SSE...');
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');

      // Send initial connection message
      res.write(`data: ${JSON.stringify({
        status: 'connected',
        importId,
        total: results.length,
        message: 'Importación iniciada'
      })}\n\n`);
      console.log('[IMPORT DEBUG] Mensaje inicial SSE enviado');

      // Process products with real-time updates
      console.log('[IMPORT DEBUG] Iniciando procesamiento...');
      const importResult = await productService.bulkImportProductsWithProgress(
        importId,
        req.tenantId,
        results,
        req.user.id,
        (progressData) => {
          console.log('[IMPORT DEBUG] Enviando progreso SSE:', progressData.progress + '%');
          res.write(`data: ${JSON.stringify({
            status: 'processing',
            progress: progressData.progress,
            processed: progressData.processed,
            total: results.length,
            successCount: progressData.successCount,
            errorCount: progressData.errorCount,
            message: progressData.message
          })}\n\n`);
        }
      );

      // Send final completion message
      console.log('[IMPORT DEBUG] Importación completada. Enviando mensaje final SSE');
      res.write(`data: ${JSON.stringify({
        status: 'completed',
        progress: 100,
        processed: importResult.success.length + importResult.errors.length,
        total: results.length,
        successCount: importResult.success.length,
        errorCount: importResult.errors.length,
        message: 'Importación completada',
        results: importResult
      })}\n\n`);

      console.log('[IMPORT DEBUG] Cerrando conexión SSE');
      res.end();
    } catch (error) {
      console.error('[IMPORT DEBUG] ERROR en handler:', error);

      // Send error via SSE if headers already sent
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({
          status: 'error',
          message: error.message
        })}\n\n`);
        res.end();
      } else {
        next(error);
      }
    }
  };
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
    // Check SaaS plan limit for products
    if (!req.user.isSuperadmin && req.user.role !== 'superadmin') {
      await limitService.checkResourceLimit(req.tenantId, req.tenant.plan, 'products');
    }

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
