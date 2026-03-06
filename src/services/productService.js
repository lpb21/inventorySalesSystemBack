/**
 * Product Service
 * Handles product business logic
 */
const { Op } = require('sequelize');
const { Product, Category, InventoryMovement, Tenant } = require('../models');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { getPaginationSkip, formatPagination } = require('../utils/helpers');
const auditService = require('./auditService');
const cacheService = require('./cacheService');

const PRODUCTS_CACHE_TTL = 60; // 1 minute

class ProductService {
  /**
   * Create new product
   */
  async createProduct(tenantId, productData, userId) {
    // Check product limit for tenant plan
    const tenant = await Tenant.findByPk(tenantId);
    const productCount = await Product.count({ where: { tenant_id: tenantId } });
    
    if (productCount >= tenant.max_products) {
      throw new ValidationError(`Límite de productos alcanzado para el plan ${tenant.plan}`);
    }

    // Check category exists and belongs to tenant
    const category = await Category.findOne({
      where: { id: productData.category_id, tenant_id: tenantId },
    });

    if (!category) {
      throw new NotFoundError('Categoría no encontrada');
    }

    // Check unique constraints (sku, barcode)
    if (productData.sku) {
      const existingSku = await Product.findOne({
        where: { tenant_id: tenantId, sku: productData.sku },
      });
      if (existingSku) {
        throw new ValidationError('El SKU ya está en uso');
      }
    }

    if (productData.barcode) {
      const existingBarcode = await Product.findOne({
        where: { tenant_id: tenantId, barcode: productData.barcode },
      });
      if (existingBarcode) {
        throw new ValidationError('El código de barras ya está en uso');
      }
    }

    const product = await Product.create({
      ...productData,
      tenant_id: tenantId,
    });

    // Log audit
    await auditService.logProductCreate({
      tenantId,
      userId,
      product,
    });

    // Invalidate products list cache
    cacheService.invalidate(cacheService.getProductsPattern(tenantId)).catch(() => {});

    return product;
  }

  /**
   * Update product
   */
  async updateProduct(tenantId, productId, productData, userId) {
    const product = await Product.findOne({
      where: { id: productId, tenant_id: tenantId },
    });

    if (!product) {
      throw new NotFoundError('Producto no encontrado');
    }

    // Store old data for audit
    const oldData = {
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      price: product.price,
      cost: product.cost,
      stock: product.stock,
    };

    // Check unique constraints if being updated
    if (productData.sku && productData.sku !== product.sku) {
      const existingSku = await Product.findOne({
        where: { tenant_id: tenantId, sku: productData.sku, id: { [Op.ne]: productId } },
      });
      if (existingSku) {
        throw new ValidationError('El SKU ya está en uso');
      }
    }

    if (productData.barcode && productData.barcode !== product.barcode) {
      const existingBarcode = await Product.findOne({
        where: { tenant_id: tenantId, barcode: productData.barcode, id: { [Op.ne]: productId } },
      });
      if (existingBarcode) {
        throw new ValidationError('El código de barras ya está en uso');
      }
    }

    await product.update(productData);

    // Log audit for product update
    await auditService.logProductUpdate({
      tenantId,
      userId,
      product,
      oldData,
      newData: productData,
    });

    // Invalidate products list cache
    cacheService.invalidate(cacheService.getProductsPattern(tenantId)).catch(() => {});

    return product;
  }

  /**
   * Delete product (soft delete) - only if stock is 0
   */
  async deleteProduct(tenantId, productId, userId) {
    const product = await Product.findOne({
      where: { id: productId, tenant_id: tenantId },
    });

    if (!product) {
      throw new NotFoundError('Producto no encontrado');
    }

    // Check if product has stock
    const currentStock = parseFloat(product.stock) || 0;
    if (currentStock > 0) {
      throw new ValidationError(`No se puede eliminar el producto. Existencias actuales: ${currentStock}. Primero debe vaciar el inventario.`);
    }

    await product.update({ is_active: false });

    // Log audit for product deletion
    await auditService.logProductDelete({
      tenantId,
      userId,
      product,
    });

    // Invalidate products list cache
    cacheService.invalidate(cacheService.getProductsPattern(tenantId)).catch(() => {});

    return { message: 'Producto eliminado correctamente' };
  }

  /**
   * Get products with pagination and filters
   */
  async getProducts(tenantId, { page = 1, limit = 20, category_id, search, is_active } = {}) {
    // Build a filter key for cache
    const filterKey = [category_id || '', search || '', is_active || ''].join('|');
    const cacheKey = cacheService.getProductsKey(tenantId, page, limit, filterKey);

    // Try cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) return cached;

    const where = { tenant_id: tenantId };
    
    if (category_id) {
      where.category_id = category_id;
    }
    
    if (is_active !== undefined) {
      where.is_active = is_active === 'true';
    }
    
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { sku: { [Op.iLike]: `%${search}%` } },
        { barcode: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await Product.findAndCountAll({
      where,
      include: [{ model: Category, as: 'category', attributes: ['id', 'name', 'icon'] }],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: getPaginationSkip(page, limit),
    });

    const result = {
      products: rows,
      pagination: formatPagination(page, limit, count),
    };

    // Cache for 60s
    cacheService.set(cacheKey, result, PRODUCTS_CACHE_TTL).catch(() => {});

    return result;
  }

  /**
   * Get product by ID
   */
  async getProductById(tenantId, productId) {
    const product = await Product.findOne({
      where: { id: productId, tenant_id: tenantId },
      include: [{ model: Category, as: 'category' }],
    });

    if (!product) {
      throw new NotFoundError('Producto no encontrado');
    }

    return product;
  }

  /**
   * Get product by barcode
   */
  async getProductByBarcode(tenantId, barcode) {
    const product = await Product.findOne({
      where: { tenant_id: tenantId, barcode, is_active: true },
      include: [{ model: Category, as: 'category' }],
    });

    if (!product) {
      throw new NotFoundError('Producto no encontrado');
    }

    return product;
  }

  /**
   * Get low stock products
   */
  async getLowStockProducts(tenantId) {
    const products = await Product.findAll({
      where: {
        tenant_id: tenantId,
        is_active: true,
        stock: { [Op.lte]: { [Op.col]: 'min_stock' } },
      },
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
      order: [['stock', 'ASC']],
    });

    return products;
  }

  /**
   * Search products
   */
  async searchProducts(tenantId, query, limit = 10) {
    const products = await Product.findAll({
      where: {
        tenant_id: tenantId,
        is_active: true,
        [Op.or]: [
          { name: { [Op.iLike]: `%${query}%` } },
          { sku: { [Op.iLike]: `%${query}%` } },
          { barcode: { [Op.iLike]: `%${query}%` } },
        ],
      },
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
      limit: parseInt(limit),
    });

    return products;
  }

  /**
   * Adjust product stock
   */
  async adjustStock(tenantId, productId, quantity, type, reason, userId) {
    const product = await Product.findOne({
      where: { id: productId, tenant_id: tenantId },
    });

    if (!product) {
      throw new NotFoundError('Producto no encontrado');
    }

    // Ensure stock is a valid number, default to 0 if null/undefined
    const previousStock = parseFloat(product.stock) || 0;
    let newStock;

    switch (type) {
      case 'in':
        newStock = previousStock + Math.abs(quantity);
        break;
      case 'out':
      case 'sale':
        newStock = previousStock - Math.abs(quantity);
        if (newStock < 0) {
          throw new ValidationError('Stock insuficiente');
        }
        break;
      case 'adjustment':
        newStock = Math.abs(quantity);
        break;
      default:
        throw new ValidationError('Tipo de movimiento inválido');
    }

    // Update product stock
    await product.update({ stock: newStock });

    // Record inventory movement
    await InventoryMovement.create({
      tenant_id: tenantId,
      product_id: productId,
      user_id: userId,
      type,
      quantity: Math.abs(quantity),
      stock_before: previousStock,
      stock_after: newStock,
      reason,
    });

    // Invalidate products list cache
    cacheService.invalidate(cacheService.getProductsPattern(tenantId)).catch(() => {});

    return product;
  }

  /**
   * Bulk import products from CSV data
   */
  async bulkImportProducts(tenantId, productsData, userId) {
    const results = {
      success: [],
      errors: [],
      total: productsData.length,
    };

    // Get tenant to check product limit
    const tenant = await Tenant.findByPk(tenantId);
    const currentProductCount = await Product.count({ where: { tenant_id: tenantId } });
    const availableSlots = tenant.max_products - currentProductCount;

    if (availableSlots <= 0) {
      throw new ValidationError(`Límite de productos alcanzado para el plan ${tenant.plan}`);
    }

    // Get all categories for this tenant to validate category_id
    const categories = await Category.findAll({
      where: { tenant_id: tenantId, is_active: true },
      attributes: ['id', 'name'],
    });
    const categoryMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));

    // Get existing SKUs and barcodes to avoid duplicates
    const existingProducts = await Product.findAll({
      where: { tenant_id: tenantId },
      attributes: ['sku', 'barcode'],
    });
    const existingSkus = new Set(existingProducts.map(p => p.sku?.toLowerCase()).filter(Boolean));
    const existingBarcodes = new Set(existingProducts.map(p => p.barcode?.toLowerCase()).filter(Boolean));

    // Process each product
    for (let i = 0; i < productsData.length; i++) {
      const row = productsData[i];
      const rowNum = i + 2; // +2 because CSV has header and is 0-indexed

      try {
        // Validate required fields
        if (!row.name || row.name.trim() === '') {
          results.errors.push({ row: rowNum, error: 'Nombre requerido' });
          continue;
        }

        // Validate and resolve category
        let categoryId = null;
        if (row.category) {
          const categoryName = row.category.toLowerCase().trim();
          if (categoryMap.has(categoryName)) {
            categoryId = categoryMap.get(categoryName);
          } else {
            results.errors.push({ row: rowNum, error: `Categoría "${row.category}" no encontrada` });
            continue;
          }
        }

        // Check SKU uniqueness
        const sku = row.sku ? row.sku.trim().toUpperCase() : null;
        if (sku && existingSkus.has(sku.toLowerCase())) {
          results.errors.push({ row: rowNum, error: `SKU "${sku}" ya existe` });
          continue;
        }

        // Check barcode uniqueness
        const barcode = row.barcode ? row.barcode.trim() : null;
        if (barcode && existingBarcodes.has(barcode.toLowerCase())) {
          results.errors.push({ row: rowNum, error: `Código de barras "${barcode}" ya existe` });
          continue;
        }

        // Parse numeric fields
        const price = row.price ? parseFloat(row.price) : 0;
        const cost = row.cost ? parseFloat(row.cost) : 0;
        const stock = row.stock ? parseFloat(row.stock) : 0;
        const minStock = row.min_stock ? parseFloat(row.min_stock) : 0;

        if (isNaN(price) || price < 0) {
          results.errors.push({ row: rowNum, error: 'Precio inválido' });
          continue;
        }

        if (isNaN(cost) || cost < 0) {
          results.errors.push({ row: rowNum, error: 'Costo inválido' });
          continue;
        }

        if (isNaN(stock) || stock < 0) {
          results.errors.push({ row: rowNum, error: 'Stock inválido' });
          continue;
        }

        // Create the product
        const product = await Product.create({
          tenant_id: tenantId,
          category_id: categoryId,
          name: row.name.trim(),
          description: row.description ? row.description.trim() : null,
          sku,
          barcode,
          price,
          cost,
          stock,
          min_stock: minStock,
          unit: row.unit || 'und',
          type: row.type || 'unit',
          image_url: row.image_url ? row.image_url.trim() : null,
          expiry_date: row.expiry_date ? row.expiry_date.trim() : null,
          is_active: true,
        });

        // Add to existing sets to prevent duplicates in same batch
        if (sku) existingSkus.add(sku.toLowerCase());
        if (barcode) existingBarcodes.add(barcode.toLowerCase());

        results.success.push({
          row: rowNum,
          id: product.id,
          name: product.name,
          sku: product.sku,
        });

      } catch (error) {
        results.errors.push({ row: rowNum, error: error.message });
      }
    }

    // Invalidate products list cache
    cacheService.invalidate(cacheService.getProductsPattern(tenantId)).catch(() => {});

    return results;
  }

  /**
   * Bulk import products from CSV data with progress callback
   */
  async bulkImportProductsWithProgress(importId, tenantId, productsData, userId, onProgress) {
    const results = {
      success: [],
      errors: [],
      total: productsData.length,
    };

    // Get tenant to check product limit
    const tenant = await Tenant.findByPk(tenantId);
    const currentProductCount = await Product.count({ where: { tenant_id: tenantId } });
    const availableSlots = tenant.max_products - currentProductCount;

    if (availableSlots <= 0) {
      throw new ValidationError(`Límite de productos alcanzado para el plan ${tenant.plan}`);
    }

    // Get all categories for this tenant to validate category_id
    const categories = await Category.findAll({
      where: { tenant_id: tenantId, is_active: true },
      attributes: ['id', 'name'],
    });
    const categoryMap = new Map(categories.map(c => [c.name.toLowerCase(), c.id]));

    // Get existing SKUs and barcodes to avoid duplicates
    const existingProducts = await Product.findAll({
      where: { tenant_id: tenantId },
      attributes: ['sku', 'barcode'],
    });
    const existingSkus = new Set(existingProducts.map(p => p.sku?.toLowerCase()).filter(Boolean));
    const existingBarcodes = new Set(existingProducts.map(p => p.barcode?.toLowerCase()).filter(Boolean));

    // Process each product with progress updates
    for (let i = 0; i < productsData.length; i++) {
      const row = productsData[i];
      const rowNum = i + 2;

      try {
        // Validate required fields
        if (!row.name || row.name.trim() === '') {
          results.errors.push({ row: rowNum, error: 'Nombre requerido' });
          onProgress({
            status: 'processing',
            progress: Math.round(((i + 1) / productsData.length) * 100),
            processed: i + 1,
            successCount: results.success.length,
            errorCount: results.errors.length,
            message: `Procesando fila ${i + 1} de ${productsData.length}...`
          });
          continue;
        }

        // Validate and resolve category
        let categoryId = null;
        if (row.category) {
          const categoryName = row.category.toLowerCase().trim();
          if (categoryMap.has(categoryName)) {
            categoryId = categoryMap.get(categoryName);
          } else {
            results.errors.push({ row: rowNum, error: `Categoría "${row.category}" no encontrada` });
            onProgress({
              status: 'processing',
              progress: Math.round(((i + 1) / productsData.length) * 100),
              processed: i + 1,
              successCount: results.success.length,
              errorCount: results.errors.length,
              message: `Procesando fila ${i + 1} de ${productsData.length}...`
            });
            continue;
          }
        }

        // Check SKU uniqueness
        const sku = row.sku ? row.sku.trim().toUpperCase() : null;
        if (sku && existingSkus.has(sku.toLowerCase())) {
          results.errors.push({ row: rowNum, error: `SKU "${sku}" ya existe` });
          onProgress({
            status: 'processing',
            progress: Math.round(((i + 1) / productsData.length) * 100),
            processed: i + 1,
            successCount: results.success.length,
            errorCount: results.errors.length,
            message: `Procesando fila ${i + 1} de ${productsData.length}...`
          });
          continue;
        }

        // Check barcode uniqueness
        const barcode = row.barcode ? row.barcode.trim() : null;
        if (barcode && existingBarcodes.has(barcode.toLowerCase())) {
          results.errors.push({ row: rowNum, error: `Código de barras "${barcode}" ya existe` });
          onProgress({
            status: 'processing',
            progress: Math.round(((i + 1) / productsData.length) * 100),
            processed: i + 1,
            successCount: results.success.length,
            errorCount: results.errors.length,
            message: `Procesando fila ${i + 1} de ${productsData.length}...`
          });
          continue;
        }

        // Parse numeric fields
        const price = row.price ? parseFloat(row.price) : 0;
        const cost = row.cost ? parseFloat(row.cost) : 0;
        const stock = row.stock ? parseFloat(row.stock) : 0;
        const minStock = row.min_stock ? parseFloat(row.min_stock) : 0;

        if (isNaN(price) || price < 0) {
          results.errors.push({ row: rowNum, error: 'Precio inválido' });
          onProgress({
            status: 'processing',
            progress: Math.round(((i + 1) / productsData.length) * 100),
            processed: i + 1,
            successCount: results.success.length,
            errorCount: results.errors.length,
            message: `Procesando fila ${i + 1} de ${productsData.length}...`
          });
          continue;
        }

        if (isNaN(cost) || cost < 0) {
          results.errors.push({ row: rowNum, error: 'Costo inválido' });
          onProgress({
            status: 'processing',
            progress: Math.round(((i + 1) / productsData.length) * 100),
            processed: i + 1,
            successCount: results.success.length,
            errorCount: results.errors.length,
            message: `Procesando fila ${i + 1} de ${productsData.length}...`
          });
          continue;
        }

        if (isNaN(stock) || stock < 0) {
          results.errors.push({ row: rowNum, error: 'Stock inválido' });
          onProgress({
            status: 'processing',
            progress: Math.round(((i + 1) / productsData.length) * 100),
            processed: i + 1,
            successCount: results.success.length,
            errorCount: results.errors.length,
            message: `Procesando fila ${i + 1} de ${productsData.length}...`
          });
          continue;
        }

        // Create the product
        const product = await Product.create({
          tenant_id: tenantId,
          category_id: categoryId,
          name: row.name.trim(),
          description: row.description ? row.description.trim() : null,
          sku,
          barcode,
          price,
          cost,
          stock,
          min_stock: minStock,
          unit: row.unit || 'und',
          type: row.type || 'unit',
          image_url: row.image_url ? row.image_url.trim() : null,
          expiry_date: row.expiry_date ? row.expiry_date.trim() : null,
          is_active: true,
        });

        // Add to existing sets to prevent duplicates in same batch
        if (sku) existingSkus.add(sku.toLowerCase());
        if (barcode) existingBarcodes.add(barcode.toLowerCase());

        results.success.push({
          row: rowNum,
          id: product.id,
          name: product.name,
          sku: product.sku,
        });

        // Emit progress update
        onProgress({
          status: 'processing',
          progress: Math.round(((i + 1) / productsData.length) * 100),
          processed: i + 1,
          successCount: results.success.length,
          errorCount: results.errors.length,
          message: `Procesando fila ${i + 1} de ${productsData.length}...`
        });

      } catch (error) {
        results.errors.push({ row: rowNum, error: error.message });
        onProgress({
          status: 'processing',
          progress: Math.round(((i + 1) / productsData.length) * 100),
          processed: i + 1,
          successCount: results.success.length,
          errorCount: results.errors.length,
          message: `Procesando fila ${i + 1} de ${productsData.length}...`
        });
      }
    }

    // Invalidate products list cache
    cacheService.invalidate(cacheService.getProductsPattern(tenantId)).catch(() => {});

    return results;
  }
}

module.exports = new ProductService();
