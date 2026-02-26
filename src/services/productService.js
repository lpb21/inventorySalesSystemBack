/**
 * Product Service
 * Handles product business logic
 */
const { Op } = require('sequelize');
const { Product, Category, InventoryMovement, Tenant } = require('../models');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { getPaginationSkip, formatPagination } = require('../utils/helpers');

class ProductService {
  /**
   * Create new product
   */
  async createProduct(tenantId, productData) {
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

    return product;
  }

  /**
   * Update product
   */
  async updateProduct(tenantId, productId, productData) {
    const product = await Product.findOne({
      where: { id: productId, tenant_id: tenantId },
    });

    if (!product) {
      throw new NotFoundError('Producto no encontrado');
    }

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
    return product;
  }

  /**
   * Delete product (soft delete)
   */
  async deleteProduct(tenantId, productId) {
    const product = await Product.findOne({
      where: { id: productId, tenant_id: tenantId },
    });

    if (!product) {
      throw new NotFoundError('Producto no encontrado');
    }

    await product.update({ is_active: false });
    return { message: 'Producto eliminado correctamente' };
  }

  /**
   * Get products with pagination and filters
   */
  async getProducts(tenantId, { page = 1, limit = 20, category_id, search, is_active } = {}) {
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

    return {
      products: rows,
      pagination: formatPagination(page, limit, count),
    };
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

    const previousStock = parseFloat(product.stock);
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
      previous_stock: previousStock,
      new_stock: newStock,
      reason,
    });

    return product;
  }
}

module.exports = new ProductService();
