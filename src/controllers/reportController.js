/**
 * Report Controller
 * Handles report endpoints
 */
const { Op } = require('sequelize');
const { Sale, SaleItem, Product, InventoryMovement, User, Category } = require('../models');
const { asyncHandler, formatResponse, formatPagination, getPaginationSkip } = require('../utils/helpers');

class ReportController {
  /**
   * GET /v1/reports/dashboard
   * Get dashboard data
   */
  getDashboard = asyncHandler(async (req, res, next) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Today's sales with items for profit calculation
    const todaySales = await Sale.findAll({
      where: {
        tenant_id: req.tenantId,
        created_at: { [Op.gte]: today, [Op.lte]: todayEnd },
        status: 'completed',
      },
      include: [
        {
          model: SaleItem,
          as: 'items',
          include: [{ model: Product, as: 'product', attributes: ['id', 'cost'] }],
        },
      ],
    });

    // Calculate today's revenue
    const todayRevenue = todaySales.reduce((sum, sale) => sum + parseFloat(sale.total), 0);

    // Calculate today's cost and profit
    const todayCost = todaySales.reduce((sum, sale) => {
      return sum + sale.items.reduce((itemSum, item) => {
        return itemSum + (parseFloat(item.product?.cost || 0) * parseFloat(item.quantity));
      }, 0);
    }, 0);
    const todayProfit = todayRevenue - todayCost;
    const todayTransactions = todaySales.length;

    // Total products
    const totalProducts = await Product.count({
      where: { tenant_id: req.tenantId, is_active: true },
    });

    // Low stock products
    const lowStockProducts = await Product.findAll({
      where: {
        tenant_id: req.tenantId,
        is_active: true,
        stock: { [Op.lte]: { [Op.col]: 'min_stock' } },
      },
      attributes: ['id', 'name', 'stock', 'min_stock'],
      limit: 10,
    });

    // Recent sales
    const recentSales = await Sale.findAll({
      where: { tenant_id: req.tenantId, status: 'completed' },
      include: [
        { model: User, as: 'user', attributes: ['name'] },
      ],
      order: [['created_at', 'DESC']],
      limit: 5,
    });

    res.status(200).json(formatResponse({
      summary: {
        todayRevenue,
        todayProfit,
        todayTransactions,
        totalProducts,
        lowStockCount: lowStockProducts.length,
      },
      lowStockProducts,
      recentSales,
    }));
  });

  /**
   * GET /v1/reports/sales
   * Get sales report
   */
  getSalesReport = asyncHandler(async (req, res, next) => {
    const { start_date, end_date, page = 1, limit = 20 } = req.query;

    const where = { tenant_id: req.tenantId, status: 'completed' };

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
        { model: User, as: 'user', attributes: ['name'] },
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: getPaginationSkip(page, limit),
    });

    const totalRevenue = rows.reduce((sum, sale) => sum + parseFloat(sale.total), 0);

    res.status(200).json(formatResponse({
      sales: rows,
      summary: {
        totalSales: count,
        totalRevenue,
      },
      pagination: formatPagination(page, limit, count),
    }));
  });

  /**
   * GET /v1/reports/inventory
   * Get inventory report
   */
  getInventoryReport = asyncHandler(async (req, res, next) => {
    const { page = 1, limit = 20 } = req.query;

    const { count, rows } = await Product.findAndCountAll({
      where: { tenant_id: req.tenantId, is_active: true },
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
      order: [['name', 'ASC']],
      limit: parseInt(limit),
      offset: getPaginationSkip(page, limit),
    });

    const totalValue = rows.reduce((sum, product) => {
      return sum + (parseFloat(product.stock) * parseFloat(product.cost));
    }, 0);

    res.status(200).json(formatResponse({
      products: rows,
      summary: {
        totalProducts: count,
        totalValue,
      },
      pagination: formatPagination(page, limit, count),
    }));
  });

  /**
   * GET /v1/reports/profits
   * Get profit report
   */
  getProfitReport = asyncHandler(async (req, res, next) => {
    const { start_date, end_date } = req.query;

    const where = { tenant_id: req.tenantId, status: 'completed' };

    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) {
        where.created_at[Op.gte] = new Date(start_date);
      }
      if (end_date) {
        where.created_at[Op.lte] = new Date(end_date);
      }
    }

    const sales = await Sale.findAll({
      where,
      include: [
        {
          model: SaleItem,
          as: 'items',
          include: [{ model: Product, as: 'product', attributes: ['id', 'cost'] }],
        },
      ],
    });

    let totalRevenue = 0;
    let totalCost = 0;

    for (const sale of sales) {
      totalRevenue += parseFloat(sale.total);
      for (const item of sale.items) {
        const cost = parseFloat(item.product?.cost || 0);
        totalCost += cost * parseFloat(item.quantity);
      }
    }

    const profit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    res.status(200).json(formatResponse({
      summary: {
        totalRevenue,
        totalCost,
        profit,
        profitMargin: profitMargin.toFixed(2),
      },
    }));
  });

  /**
   * GET /v1/reports/top-products
   * Get top selling products
   */
  getTopProducts = asyncHandler(async (req, res, next) => {
    const { start_date, end_date, limit = 10 } = req.query;

    const dateWhere = {};
    if (start_date) {
      dateWhere[Op.gte] = new Date(start_date);
    }
    if (end_date) {
      dateWhere[Op.lte] = new Date(end_date);
    }

    const sales = await Sale.findAll({
      where: {
        tenant_id: req.tenantId,
        status: 'completed',
        ...(start_date || end_date ? { created_at: dateWhere } : {}),
      },
      include: [
        {
          model: SaleItem,
          as: 'items',
        },
      ],
    });

    // Aggregate product sales
    const productSales = {};
    for (const sale of sales) {
      for (const item of sale.items) {
        if (!productSales[item.product_id]) {
          productSales[item.product_id] = {
            product_id: item.product_id,
            quantity_sold: 0,
            total_revenue: 0,
          };
        }
        productSales[item.product_id].quantity_sold += parseFloat(item.quantity);
        productSales[item.product_id].total_revenue += parseFloat(item.total_price);
      }
    }

    // Get product details
    const sortedProducts = Object.values(productSales)
      .sort((a, b) => b.quantity_sold - a.quantity_sold)
      .slice(0, parseInt(limit));

    const productIds = sortedProducts.map(p => p.product_id);
    const products = await Product.findAll({
      where: { id: { [Op.in]: productIds } },
      attributes: ['id', 'name', 'sku'],
    });

    const productMap = products.reduce((map, p) => {
      map[p.id] = p;
      return map;
    }, {});

    const topProducts = sortedProducts.map(p => ({
      ...p,
      product: productMap[p.product_id],
    }));

    res.status(200).json(formatResponse(topProducts));
  });

  /**
   * GET /v1/reports/low-stock
   * Get low stock report
   */
  getLowStockReport = asyncHandler(async (req, res, next) => {
    const products = await Product.findAll({
      where: {
        tenant_id: req.tenantId,
        is_active: true,
        stock: { [Op.lte]: { [Op.col]: 'min_stock' } },
      },
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
      order: [['stock', 'ASC']],
    });

    res.status(200).json(formatResponse(products));
  });
}

module.exports = new ReportController();
