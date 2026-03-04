/**
 * Report Controller
 * Handles report endpoints — uses SQL aggregations for performance
 */
const { Op, fn, col, literal } = require('sequelize');
const { Sale, SaleItem, Product, InventoryMovement, User, Category, AuditLog, sequelize } = require('../models');
const { asyncHandler, formatResponse, formatPagination, getPaginationSkip } = require('../utils/helpers');
const auditService = require('../services/auditService');
const cacheService = require('../services/cacheService');

const DASHBOARD_CACHE_TTL = 30; // 30 seconds
class ReportController {
  /**
   * GET /v1/reports/dashboard
   * Get dashboard data
   */
  getDashboard = asyncHandler(async (req, res, next) => {
    // Try to get from cache first
    const cacheKey = cacheService.getDashboardKey(req.tenantId);
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return res.status(200).json(formatResponse(cached));
    }

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

    const dashboardData = {
      summary: {
        todayRevenue,
        todayProfit,
        todayTransactions,
        totalProducts,
        lowStockCount: lowStockProducts.length,
      },
      lowStockProducts,
      recentSales,
    };

    // Cache for 30 seconds
    cacheService.set(cacheKey, dashboardData, DASHBOARD_CACHE_TTL).catch(() => {});

    res.status(200).json(formatResponse(dashboardData));
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

    // Build date filter for raw SQL
    const dateConditions = [];
    const replacements = { tenantId: req.tenantId };

    if (start_date) {
      dateConditions.push('s.created_at >= :startDate');
      replacements.startDate = new Date(start_date);
    }
    if (end_date) {
      dateConditions.push('s.created_at <= :endDate');
      replacements.endDate = new Date(end_date);
    }

    const dateFilter = dateConditions.length > 0
      ? 'AND ' + dateConditions.join(' AND ')
      : '';

    // Use SQL aggregation instead of loading all rows into memory
    const [result] = await sequelize.query(`
      SELECT 
        COALESCE(SUM(s.total), 0) AS "totalRevenue",
        COALESCE(SUM(si.quantity * COALESCE(p.cost, 0)), 0) AS "totalCost"
      FROM sales s
      JOIN sale_items si ON si.sale_id = s.id
      LEFT JOIN products p ON p.id = si.product_id
      WHERE s.tenant_id = :tenantId
        AND s.status = 'completed'
        ${dateFilter}
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    const totalRevenue = parseFloat(result.totalRevenue) || 0;
    const totalCost = parseFloat(result.totalCost) || 0;
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

    // Build date filter
    const dateConditions = [];
    const replacements = { tenantId: req.tenantId, limit: parseInt(limit) };

    if (start_date) {
      dateConditions.push('s.created_at >= :startDate');
      replacements.startDate = new Date(start_date);
    }
    if (end_date) {
      dateConditions.push('s.created_at <= :endDate');
      replacements.endDate = new Date(end_date);
    }

    const dateFilter = dateConditions.length > 0
      ? 'AND ' + dateConditions.join(' AND ')
      : '';

    // Use SQL GROUP BY instead of loading all sales into memory
    const topProducts = await sequelize.query(`
      SELECT 
        si.product_id,
        p.name AS product_name,
        p.sku AS product_sku,
        SUM(si.quantity) AS quantity_sold,
        SUM(si.subtotal) AS total_revenue
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      JOIN products p ON p.id = si.product_id
      WHERE s.tenant_id = :tenantId
        AND s.status = 'completed'
        ${dateFilter}
      GROUP BY si.product_id, p.name, p.sku
      ORDER BY quantity_sold DESC
      LIMIT :limit
    `, { replacements, type: sequelize.QueryTypes.SELECT });

    const result = topProducts.map(p => ({
      product_id: p.product_id,
      quantity_sold: parseFloat(p.quantity_sold),
      total_revenue: parseFloat(p.total_revenue),
      product: {
        id: p.product_id,
        name: p.product_name,
        sku: p.product_sku,
      },
    }));

    res.status(200).json(formatResponse(result));
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

  /**
   * GET /v1/reports/low-rotation
   * Get products with low or no sales in a period
   */
  getLowRotationProducts = asyncHandler(async (req, res, next) => {
    const { days = 30, limit = 20 } = req.query;
    const daysNum = parseInt(days) || 30;
    const limitNum = parseInt(limit) || 20;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysNum);
    startDate.setHours(0, 0, 0, 0);

    // Get all active products for the tenant
    const allProducts = await Product.findAll({
      where: {
        tenant_id: req.tenantId,
        is_active: true,
      },
      attributes: ['id', 'name', 'sku', 'stock', 'cost', 'price'],
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
    });

    // Get sales in the period
    const sales = await Sale.findAll({
      where: {
        tenant_id: req.tenantId,
        status: 'completed',
        created_at: { [Op.gte]: startDate },
      },
      include: [
        {
          model: SaleItem,
          as: 'items',
          attributes: ['product_id', 'quantity'],
        },
      ],
    });

    // Aggregate sales by product
    const productSales = {};
    for (const sale of sales) {
      for (const item of sale.items) {
        if (!productSales[item.product_id]) {
          productSales[item.product_id] = 0;
        }
        productSales[item.product_id] += parseFloat(item.quantity);
      }
    }

    // Filter products with no or very low sales
    const lowRotationProducts = allProducts
      .filter(product => {
        const salesQty = productSales[product.id] || 0;
        return salesQty === 0;
      })
      .map(product => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        stock: product.stock,
        cost: product.cost,
        price: product.price,
        category: product.category,
        total_sold: 0,
        last_sale_date: null,
      }))
      .slice(0, limitNum);

    res.status(200).json(formatResponse({
      products: lowRotationProducts,
      summary: {
        totalProducts: allProducts.length,
        lowRotationCount: lowRotationProducts.length,
        periodDays: daysNum,
      },
    }));
  });

  /**
   * GET /v1/reports/audit-logs
   * Get audit logs with filters
   */
  getAuditLogs = asyncHandler(async (req, res, next) => {
    const { 
      page = 1, 
      limit = 20, 
      entityType, 
      entityId, 
      action, 
      userId,
      startDate, 
      endDate 
    } = req.query;

    const result = await auditService.getAuditLogs(req.tenantId, {
      page: parseInt(page),
      limit: parseInt(limit),
      entityType,
      entityId,
      action,
      userId,
      startDate,
      endDate,
    });

    res.status(200).json(formatResponse(result));
  });
}

module.exports = new ReportController();
