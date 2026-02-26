/**
 * Sale Service
 * Handles sales business logic
 */
const { Op } = require('sequelize');
const { Sale, SaleItem, Product, InventoryMovement, sequelize } = require('../models');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { getPaginationSkip, formatPagination } = require('../utils/helpers');

class SaleService {
  /**
   * Create new sale - OPTIMIZED for speed
   */
  async createSale(tenantId, saleData, userId) {
    const transaction = await sequelize.transaction();

    try {
      // Validate products and calculate totals
      const items = [];
      let calculatedSubtotal = 0;

      for (const item of saleData.items) {
        const product = await Product.findOne({
          where: { id: item.product_id, tenant_id: tenantId, is_active: true },
        });

        if (!product) {
          throw new NotFoundError(`Producto no encontrado: ${item.product_id}`);
        }

        // Check stock
        if (product.stock < item.quantity) {
          throw new ValidationError(`Stock insuficiente para ${product.name}`);
        }

        // Calculate item total
        const itemTotal = item.total_price 
          ? parseFloat(item.total_price) 
          : parseFloat(item.quantity) * parseFloat(item.unit_price);
        calculatedSubtotal += itemTotal;

        items.push({
          product_id: product.id,
          product_name: product.name, // Store for quick response
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: itemTotal,
        });

        // Deduct stock
        const previousStock = parseFloat(product.stock);
        const newStock = previousStock - parseFloat(item.quantity);
        await product.update({ stock: newStock }, { transaction });

        // Record inventory movement (async - don't wait)
        InventoryMovement.create({
          tenant_id: tenantId,
          product_id: product.id,
          user_id: userId,
          type: 'sale',
          quantity: item.quantity,
          previous_stock: previousStock,
          new_stock: newStock,
          reason: 'Venta',
        }).catch(console.error); // Log error but don't fail the sale
      }

      // Calculate totals
      const subtotal = saleData.subtotal || calculatedSubtotal;
      const discount = parseFloat(saleData.discount) || 0;
      const tax = parseFloat(saleData.tax) || 0;
      const total = subtotal - discount + tax;
      
      // Si payment_received no está definido o es 0, usar el total
      const paymentReceived = parseFloat(saleData.payment_received) || total;
      const changeGiven = Math.max(0, paymentReceived - total);

      // Create sale
      const sale = await Sale.create({
        tenant_id: tenantId,
        user_id: userId,
        customer_name: saleData.customer_name,
        customer_document: saleData.customer_document,
        subtotal,
        discount,
        tax,
        total,
        payment_method: saleData.payment_method,
        amount_received: paymentReceived,
        change_given: changeGiven,
        status: 'completed',
        note: saleData.note,
      }, { transaction });

      // Create sale items
      const saleItems = await SaleItem.bulkCreate(
        items.map((item) => ({
          ...item,
          sale_id: sale.id,
          tenant_id: tenantId,
        })),
        { transaction }
      );

      await transaction.commit();

      // Return directly without extra query - MUCH FASTER!
      return {
        id: sale.id,
        tenant_id: sale.tenant_id,
        user_id: sale.user_id,
        customer_name: sale.customer_name,
        customer_document: sale.customer_document,
        subtotal: sale.subtotal,
        discount: sale.discount,
        tax: sale.tax,
        total: sale.total,
        payment_method: sale.payment_method,
        amount_received: sale.amount_received,
        change_given: sale.change_given,
        status: sale.status,
        note: sale.note,
        created_at: sale.created_at,
        items: saleItems.map(item => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.subtotal,
        })),
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get sale by ID
   */
  async getSaleById(tenantId, saleId) {
    const sale = await Sale.findOne({
      where: { id: saleId, tenant_id: tenantId },
      include: [
        {
          model: SaleItem,
          as: 'items',
          include: [{ model: Product, as: 'product', attributes: ['id', 'name', 'sku', 'barcode'] }],
        },
      ],
    });

    if (!sale) {
      throw new NotFoundError('Venta no encontrada');
    }

    return sale;
  }

  /**
   * Get sales with pagination and filters
   */
  async getSales(tenantId, { page = 1, limit = 20, status, start_date, end_date } = {}) {
    const where = { tenant_id: tenantId };

    if (status) {
      where.status = status;
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

    const { count, rows } = await Sale.findAndCountAll({
      where,
      include: [
        { model: SaleItem, as: 'items', attributes: ['id', 'product_id', 'quantity', 'unit_price', 'subtotal'] },
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: getPaginationSkip(page, limit),
    });

    return {
      sales: rows,
      pagination: formatPagination(page, limit, count),
    };
  }

  /**
   * Get today's sales
   */
  async getTodaySales(tenantId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sales = await Sale.findAll({
      where: {
        tenant_id: tenantId,
        created_at: { [Op.gte]: today },
        status: 'completed',
      },
      include: [
        { model: SaleItem, as: 'items' },
      ],
      order: [['created_at', 'DESC']],
    });

    // Calculate totals
    const totalSales = sales.length;
    const totalRevenue = sales.reduce((sum, sale) => sum + parseFloat(sale.total), 0);

    return {
      sales,
      summary: {
        totalSales,
        totalRevenue,
      },
    };
  }

  /**
   * Cancel sale
   */
  async cancelSale(tenantId, saleId, userId, reason) {
    const sale = await Sale.findOne({
      where: { id: saleId, tenant_id: tenantId },
      include: [{ model: SaleItem, as: 'items' }],
    });

    if (!sale) {
      throw new NotFoundError('Venta no encontrada');
    }

    if (sale.status !== 'completed') {
      throw new ValidationError('Solo se pueden cancelar ventas completadas');
    }

    const transaction = await sequelize.transaction();

    try {
      // Restore stock for each item
      for (const item of sale.items) {
        const product = await Product.findByPk(item.product_id, { transaction });
        const previousStock = parseFloat(product.stock);
        const newStock = previousStock + parseFloat(item.quantity);

        await product.update({ stock: newStock }, { transaction });

        // Record inventory movement
        await InventoryMovement.create({
          tenant_id: tenantId,
          product_id: item.product_id,
          user_id: userId,
          type: 'in',
          quantity: item.quantity,
          previous_stock: previousStock,
          new_stock: newStock,
          reason: `Cancelación de venta: ${reason}`,
          reference_id: saleId,
        }, { transaction });
      }

      // Update sale status
      await sale.update({
        status: 'cancelled',
        cancelled_at: new Date(),
        cancelled_reason: reason,
      }, { transaction });

      await transaction.commit();

      return this.getSaleById(tenantId, saleId);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get sales by date range
   */
  async getSalesByDateRange(tenantId, startDate, endDate) {
    const sales = await Sale.findAll({
      where: {
        tenant_id: tenantId,
        created_at: {
          [Op.gte]: new Date(startDate),
          [Op.lte]: new Date(endDate),
        },
        status: 'completed',
      },
      order: [['created_at', 'DESC']],
    });

    const totalRevenue = sales.reduce((sum, sale) => sum + parseFloat(sale.total), 0);

    return {
      sales,
      summary: {
        totalSales: sales.length,
        totalRevenue,
      },
    };
  }
}

module.exports = new SaleService();
