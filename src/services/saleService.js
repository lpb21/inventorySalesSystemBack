/**
 * Sale Service
 * Handles sales business logic
 */
const { Op } = require('sequelize');
const { Sale, SaleItem, Product, InventoryMovement, Customer, sequelize } = require('../models');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { getPaginationSkip, formatPagination } = require('../utils/helpers');
const cacheService = require('./cacheService');
const auditService = require('./auditService');


class SaleService {
  /**
   * Create new sale - OPTIMIZED with batch queries
   */
  async createSale(tenantId, saleData, userId) {
    const transaction = await sequelize.transaction();

    try {
      // Batch-load all products at once instead of one-by-one in a loop
      const productIds = saleData.items.map(item => item.product_id);
      const products = await Product.findAll({
        where: { id: { [Op.in]: productIds }, tenant_id: tenantId, is_active: true },
        transaction,
        lock: transaction.LOCK.UPDATE, // Lock rows for stock update safety
      });

      // Build a map for quick access
      const productMap = new Map(products.map(p => [p.id, p]));

      // Validate products and calculate totals
      const items = [];
      const stockUpdates = [];
      const movementRecords = [];
      let calculatedSubtotal = 0;

      for (const item of saleData.items) {
        const product = productMap.get(item.product_id);

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
          product_name: product.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: itemTotal,
        });

        // Prepare stock update
        const previousStock = parseFloat(product.stock) || 0;
        const newStock = previousStock - parseFloat(item.quantity);
        stockUpdates.push({ product, newStock });

        // Prepare inventory movement record
        movementRecords.push({
          tenant_id: tenantId,
          product_id: product.id,
          user_id: userId,
          type: 'sale',
          quantity: item.quantity,
          stock_before: previousStock,
          stock_after: newStock,
          reason: 'Venta',
        });
      }

      // Execute stock updates
      await Promise.all(
        stockUpdates.map(({ product, newStock }) =>
          product.update({ stock: newStock }, { transaction })
        )
      );

      // Bulk create inventory movements inside transaction
      const movements = await InventoryMovement.bulkCreate(movementRecords, { transaction });

      // Calculate totals
      const subtotal = saleData.subtotal || calculatedSubtotal;
      const discount = parseFloat(saleData.discount) || 0;
      const tax = parseFloat(saleData.tax) || 0;
      const total = subtotal - discount + tax;
      
      // Handle credit sales differently
      const isCreditSale = saleData.payment_method === 'credit';
      let paymentReceived, changeGiven;
      
      if (isCreditSale) {
        // For credit sales, no immediate payment received
        paymentReceived = 0;
        changeGiven = 0;
        
        // Validate customer_id is provided for credit sales
        if (!saleData.customer_id) {
          throw new ValidationError('Se requiere un cliente para ventas a crédito');
        }
        
        // Check customer credit limit
        const customer = await Customer.findOne({
          where: { id: saleData.customer_id, tenant_id: tenantId },
        });
        
        if (!customer) {
          throw new NotFoundError('Cliente no encontrado');
        }
        
        const currentBalance = parseFloat(customer.credit_balance) || 0;
        const creditLimit = parseFloat(customer.credit_limit) || 0;
        const newBalance = currentBalance + total;
        
        if (creditLimit > 0 && newBalance > creditLimit) {

          throw new ValidationError(
            'La venta no fue posible - límite de crédito alcanzado, por favor aumenta el valor del crédito'
          );
        }

        
        // Update customer credit balance
        await customer.update({ credit_balance: newBalance }, { transaction });

        // Invalidate cache for this customer (fire-and-forget)
        Promise.all([
          cacheService.invalidateKeys([
            cacheService.getCustomerBalanceKey(tenantId, saleData.customer_id),
          ]),
          cacheService.invalidate(
            cacheService.getCustomerCreditSalesPattern(tenantId, saleData.customer_id)
          ),
          cacheService.invalidate(
            cacheService.getCustomersWithCreditPattern(tenantId)
          ),
        ]).catch(() => {});
      } else {
        // Regular sale - Si payment_received no está definido o es 0, usar el total
        paymentReceived = parseFloat(saleData.payment_received) || total;
        changeGiven = Math.max(0, paymentReceived - total);
      }


      // Create sale
      const sale = await Sale.create({
        tenant_id: tenantId,
        user_id: userId,
        customer_id: saleData.customer_id || null,
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

      // Log audit asynchronously (fire-and-forget, don't slow down the response)
      for (let i = 0; i < movements.length; i++) {
        auditService.logInventoryMovement({
          tenantId,
          userId,
          product: stockUpdates[i].product,
          movement: movements[i],
        }).catch(console.error);
      }

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
        // Ensure stock is a valid number, default to 0 if null/undefined
        const previousStock = parseFloat(product.stock) || 0;
        const newStock = previousStock + parseFloat(item.quantity);

        await product.update({ stock: newStock }, { transaction });

        // Record inventory movement
        await InventoryMovement.create({
          tenant_id: tenantId,
          product_id: item.product_id,
          user_id: userId,
          type: 'in',
          quantity: item.quantity,
          stock_before: previousStock,
          stock_after: newStock,
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

      // Invalidate cache if it was a credit sale
      if (sale.payment_method === 'credit' && sale.customer_id) {
        await cacheService.invalidateKeys([
          cacheService.getCustomerBalanceKey(tenantId, sale.customer_id),
        ]);
        await cacheService.invalidate(
          cacheService.getCustomerCreditSalesPattern(tenantId, sale.customer_id)
        );
        await cacheService.invalidate(
          cacheService.getCustomersWithCreditPattern(tenantId)
        );
      }

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
