/**
 * Inventory Service
 * Handles inventory business logic
 */
const { Op } = require('sequelize');
const { Product, InventoryMovement, Category, sequelize } = require('../models');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { getPaginationSkip, formatPagination } = require('../utils/helpers');
const auditService = require('./auditService');

class InventoryService {
  /**
   * Get inventory with filters
   */
  async getInventory(tenantId, { page = 1, limit = 20, category_id, low_stock } = {}) {
    const where = { tenant_id: tenantId, is_active: true };

    if (category_id) {
      where.category_id = category_id;
    }

    if (low_stock === 'true') {
      where.stock = { [Op.lte]: { [Op.col]: 'min_stock' } };
    }

    const { count, rows } = await Product.findAndCountAll({
      where,
      include: [
        { model: Category, as: 'category', attributes: ['id', 'name', 'icon'] },
      ],
      order: [['name', 'ASC']],
      limit: parseInt(limit),
      offset: getPaginationSkip(page, limit),
    });

    return {
      products: rows,
      pagination: formatPagination(page, limit, count),
    };
  }

  /**
   * Record inventory movement
   */
  async recordMovement(tenantId, movementData) {
    const { product_id, quantity, type, reason, user_id } = movementData;

    const product = await Product.findOne({
      where: { id: product_id, tenant_id: tenantId },
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
      case 'waste':
      case 'sale':
        newStock = previousStock - Math.abs(quantity);
        if (newStock < 0) {
          throw new ValidationError('Stock insuficiente');
        }
        break;
      case 'return':
        // Devolución aumenta el stock
        newStock = previousStock + Math.abs(quantity);
        break;
      case 'adjustment':
      case 'transfer':
        newStock = Math.abs(quantity);
        break;
      default:
        throw new ValidationError('Tipo de movimiento inválido');
    }

    // Update product stock
    await product.update({ stock: newStock });

    // Record movement
    const movement = await InventoryMovement.create({
      tenant_id: tenantId,
      product_id,
      user_id,
      type,
      quantity: Math.abs(quantity),
      stock_before: previousStock,
      stock_after: newStock,
      reason,
    });

    // Log audit for inventory movement
    await auditService.logInventoryMovement({
      tenantId,
      userId: user_id,
      product,
      movement,
    });

    return movement;
  }

  /**
   * Get inventory movements
   */
  async getMovements(tenantId, { page = 1, limit = 50, product_id, start_date, end_date, type } = {}) {
    const where = { tenant_id: tenantId };

    if (product_id) {
      where.product_id = product_id;
    }

    if (type) {
      where.type = type;
    }

    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) {
        where.created_at[Op.gte] = new Date(start_date);
      }
      if (end_date) {
        where.created_at[Op.lte] = new Date(end_date);
      }
    }

    const { count, rows } = await InventoryMovement.findAndCountAll({
      where,
      include: [
        { model: Product, as: 'product', attributes: ['id', 'name', 'sku'] },
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: getPaginationSkip(page, limit),
    });

    return {
      movements: rows,
      pagination: formatPagination(page, limit, count),
    };
  }

  /**
   * Get movements for specific product
   */
  async getProductMovements(tenantId, productId, { page = 1, limit = 50 } = {}) {
    const product = await Product.findOne({
      where: { id: productId, tenant_id: tenantId },
    });

    if (!product) {
      throw new NotFoundError('Producto no encontrado');
    }

    const { count, rows } = await InventoryMovement.findAndCountAll({
      where: { tenant_id: tenantId, product_id: productId },
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: getPaginationSkip(page, limit),
    });

    return {
      product,
      movements: rows,
      pagination: formatPagination(page, limit, count),
    };
  }

  /**
   * Bulk adjust inventory
   */
  async bulkAdjustStock(tenantId, adjustments, userId) {
    const results = [];

    for (const adjustment of adjustments) {
      try {
        const { product_id, quantity, type, reason } = adjustment;
        
        const product = await Product.findOne({
          where: { id: product_id, tenant_id: tenantId },
        });

        if (!product) {
          results.push({
            product_id,
            success: false,
            error: 'Producto no encontrado',
          });
          continue;
        }

        // Ensure stock is a valid number, default to 0 if null/undefined
        const previousStock = parseFloat(product.stock) || 0;
        let newStock;

        switch (type) {
          case 'in':
            newStock = previousStock + Math.abs(quantity);
            break;
          case 'out':
          case 'waste':
          case 'sale':
            newStock = previousStock - Math.abs(quantity);
            if (newStock < 0) {
              results.push({
                product_id,
                success: false,
                error: 'Stock insuficiente',
              });
              continue;
            }
            break;
          case 'return':
            // Devolución aumenta el stock
            newStock = previousStock + Math.abs(quantity);
            break;
          case 'adjustment':
          case 'transfer':
            newStock = Math.abs(quantity);
            break;
          default:
            results.push({
              product_id,
              success: false,
              error: 'Tipo de movimiento inválido',
            });
            continue;
        }

        await product.update({ stock: newStock });

        const movement = await InventoryMovement.create({
          tenant_id: tenantId,
          product_id,
          user_id: userId,
          type,
          quantity: Math.abs(quantity),
          stock_before: previousStock,
          stock_after: newStock,
          reason,
        });

        // Log audit for bulk inventory movement
        await auditService.logInventoryMovement({
          tenantId,
          userId,
          product,
          movement,
        });

        results.push({
          product_id,
          success: true,
          previous_stock: previousStock,
          new_stock: newStock,
        });
      } catch (error) {
        results.push({
          product_id: adjustment.product_id,
          success: false,
          error: error.message,
        });
      }
    }

    return results;
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
   * Despiece / transformación de inventario.
   * Descuenta un producto origen e incrementa uno o varios productos destino.
   * Todo ocurre en una transacción: o se aplica completo, o nada.
   * Merma libre: la suma de destinos puede ser menor al origen (hueso, recortes).
   *
   * @param {string} tenantId
   * @param {object} data - { source_product_id, source_quantity, targets: [{ product_id, quantity }], reason }
   * @param {string} userId
   */
  async transform(tenantId, data, userId) {
    const { source_product_id, source_quantity, targets, reason } = data;

    // --- Validaciones de entrada ---
    const sourceQty = parseFloat(source_quantity);
    if (!(sourceQty > 0)) {
      throw new ValidationError('La cantidad de origen debe ser mayor a cero');
    }
    if (!Array.isArray(targets) || targets.length === 0) {
      throw new ValidationError('Debe indicar al menos un producto destino');
    }
    for (const t of targets) {
      if (!t.product_id || !(parseFloat(t.quantity) > 0)) {
        throw new ValidationError('Cada destino requiere product_id y una cantidad mayor a cero');
      }
    }
    // Evitar que un destino sea el mismo origen (crearía un movimiento incoherente)
    if (targets.some((t) => t.product_id === source_product_id)) {
      throw new ValidationError('El producto origen no puede ser también un destino');
    }

    return await sequelize.transaction(async (transaction) => {
      // --- 1) Cargar y bloquear el producto ORIGEN ---
      const source = await Product.findOne({
        where: { id: source_product_id, tenant_id: tenantId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!source) {
        throw new NotFoundError('Producto origen no encontrado');
      }

      const sourceStockBefore = parseFloat(source.stock) || 0;
      if (sourceStockBefore < sourceQty) {
        throw new ValidationError(
          `Stock insuficiente en ${source.name}: hay ${sourceStockBefore}, se requieren ${sourceQty}`
        );
      }

      // --- 2) Cargar y bloquear todos los productos DESTINO ---
      const targetProducts = {};
      for (const t of targets) {
        const prod = await Product.findOne({
          where: { id: t.product_id, tenant_id: tenantId },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!prod) {
          throw new NotFoundError(`Producto destino no encontrado: ${t.product_id}`);
        }
        targetProducts[t.product_id] = prod;
      }

      const movements = [];

      // --- 3) Descontar el ORIGEN y registrar su movimiento ---
      const sourceStockAfter = sourceStockBefore - sourceQty;
      await source.update({ stock: sourceStockAfter }, { transaction });

      const sourceMovement = await InventoryMovement.create({
        tenant_id: tenantId,
        product_id: source.id,
        user_id: userId,
        type: 'transformation',
        quantity: sourceQty,
        stock_before: sourceStockBefore,
        stock_after: sourceStockAfter,
        reason: reason ? `Despiece (origen): ${reason}` : 'Despiece (origen)',
      }, { transaction });
      movements.push(sourceMovement);

      // --- 4) Incrementar cada DESTINO y registrar su movimiento ---
      for (const t of targets) {
        const prod = targetProducts[t.product_id];
        const qty = parseFloat(t.quantity);
        const before = parseFloat(prod.stock) || 0;
        const after = before + qty;

        await prod.update({ stock: after }, { transaction });

        const mov = await InventoryMovement.create({
          tenant_id: tenantId,
          product_id: prod.id,
          user_id: userId,
          type: 'transformation',
          quantity: qty,
          stock_before: before,
          stock_after: after,
          reference_id: source.id, // enlaza este destino con el origen del despiece
          reason: reason ? `Despiece (destino): ${reason}` : 'Despiece (destino)',
        }, { transaction });
        movements.push(mov);
      }

      return {
        source: { product_id: source.id, name: source.name, quantity: sourceQty, stock_after: sourceStockAfter },
        targets: targets.map((t) => ({
          product_id: t.product_id,
          name: targetProducts[t.product_id].name,
          quantity: parseFloat(t.quantity),
          stock_after: parseFloat(targetProducts[t.product_id].stock),
        })),
        movements_count: movements.length,
      };
    });
  }
}

module.exports = new InventoryService();
