/**
 * Cash Register Service
 * Handles cash register business logic for shift management
 */
const { Op } = require('sequelize');
const { CashRegister, Sale, User, sequelize } = require('../models');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { getPaginationSkip, formatPagination } = require('../utils/helpers');
const auditService = require('./auditService');

class CashRegisterService {
  /**
   * Open a new cash register shift
   */
  async openShift(tenantId, shiftData, userId) {
    const transaction = await sequelize.transaction();

    try {
      // Check if user already has an open shift
      const existingOpenShift = await CashRegister.findOne({
        where: {
          tenant_id: tenantId,
          user_id: userId,
          status: 'open'
        },
        transaction
      });

      if (existingOpenShift) {
        throw new ValidationError('Ya tienes un turno abierto. Ciérralo antes de abrir uno nuevo.');
      }

      // Validate opening amount
      const openingAmount = parseFloat(shiftData.opening_amount || 0);
      if (openingAmount < 0) {
        throw new ValidationError('El monto de apertura no puede ser negativo');
      }

      // Create new shift
      const cashRegister = await CashRegister.create({
        tenant_id: tenantId,
        user_id: userId,
        name: shiftData.name || `Turno ${new Date().toLocaleDateString()}`,
        opening_amount: openingAmount,
        cash_in_drawer: openingAmount, // Initial cash in drawer
        expected_amount: openingAmount, // Will be updated with sales
        status: 'open',
        opened_at: new Date(),
      }, { transaction });

      // Log audit
      await auditService.log({
        tenantId,
        userId,
        entityType: 'CashRegister',
        entityId: cashRegister.id,
        action: 'open_shift',
        changes: {
          new: {
            name: cashRegister.name,
            opening_amount: openingAmount,
            status: 'open'
          }
        },
        description: `Turno abierto: ${cashRegister.name}`
      });

      await transaction.commit();

      return {
        ...cashRegister.toJSON(),
        message: 'Turno abierto exitosamente'
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Close a cash register shift
   */
  async closeShift(tenantId, shiftId, closingData, userId) {
    const transaction = await sequelize.transaction();

    try {
      // Find the shift
      const cashRegister = await CashRegister.findOne({
        where: {
          id: shiftId,
          tenant_id: tenantId,
          status: 'open'
        },
        transaction
      });

      if (!cashRegister) {
        throw new NotFoundError('Turno no encontrado o ya está cerrado');
      }

      // Validate user ownership (cashiers can only close their own shifts)
      if (cashRegister.user_id !== userId) {
        // Check if user is owner/manager
        const user = await User.findByPk(userId);
        if (!user || !['owner', 'manager'].includes(user.role)) {
          throw new ValidationError('Solo puedes cerrar tus propios turnos');
        }
      }

      const closingAmount = parseFloat(closingData.closing_amount);
      if (isNaN(closingAmount) || closingAmount < 0) {
        throw new ValidationError('El monto de cierre debe ser un número válido mayor o igual a 0');
      }

      // Calculate expected amount based on sales
      const salesTotal = await Sale.sum('total', {
        where: {
          cash_register_id: shiftId,
          payment_method: 'cash',
          status: 'completed'
        },
        transaction
      }) || 0;

      const expectedAmount = parseFloat(cashRegister.opening_amount) + parseFloat(salesTotal);
      const difference = closingAmount - expectedAmount;

      // Update cash register
      await cashRegister.update({
        closing_amount: closingAmount,
        expected_amount: expectedAmount,
        cash_in_drawer: closingAmount,
        status: 'closed',
        closed_at: new Date(),
      }, { transaction });

      // Log audit
      await auditService.log({
        tenantId,
        userId,
        entityType: 'CashRegister',
        entityId: cashRegister.id,
        action: 'close_shift',
        changes: {
          old: { status: 'open' },
          new: { 
            status: 'closed',
            closing_amount: closingAmount,
            expected_amount: expectedAmount,
            difference: difference
          }
        },
        description: `Turno cerrado: ${cashRegister.name} (Diferencia: $${difference})`
      });

      await transaction.commit();

      return {
        ...cashRegister.toJSON(),
        closing_amount: closingAmount,
        expected_amount: expectedAmount,
        difference: difference,
        sales_total: parseFloat(salesTotal),
        message: difference === 0 
          ? 'Turno cerrado correctamente. Cuadre exacto.' 
          : `Turno cerrado. Diferencia: $${difference} ${difference > 0 ? '(sobrante)' : '(faltante)'}`
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get a specific cash register shift
   */
  async getShiftById(tenantId, shiftId, userId, userRole) {
    const whereClause = {
      id: shiftId,
      tenant_id: tenantId
    };

    // Cashiers can only see their own shifts
    if (userRole === 'cashier') {
      whereClause.user_id = userId;
    }

    const cashRegister = await CashRegister.findOne({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    if (!cashRegister) {
      throw new NotFoundError('Turno no encontrado');
    }

    // Add sales summary
    const salesSummary = await this._getSalesSummary(shiftId);

    return {
      ...cashRegister.toJSON(),
      sales_summary: salesSummary
    };
  }

  /**
   * Get all shifts with filters
   */
  async getShifts(tenantId, options = {}, userId, userRole) {
    const {
      page = 1,
      limit = 20,
      status,
      start_date,
      end_date,
      user_id
    } = options;

    const whereClause = {
      tenant_id: tenantId
    };

    // Cashiers can only see their own shifts
    if (userRole === 'cashier') {
      whereClause.user_id = userId;
    } else if (user_id) {
      whereClause.user_id = user_id;
    }

    if (status) {
      whereClause.status = status;
    }

    if (start_date || end_date) {
      whereClause.opened_at = {};
      if (start_date) {
        whereClause.opened_at[Op.gte] = new Date(start_date);
      }
      if (end_date) {
        whereClause.opened_at[Op.lte] = new Date(end_date + 'T23:59:59');
      }
    }

    const { count, rows } = await CashRegister.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [['opened_at', 'DESC']],
      limit: parseInt(limit),
      offset: getPaginationSkip(page, limit)
    });

    return {
      shifts: rows,
      pagination: formatPagination(page, limit, count)
    };
  }

  /**
   * Get current active shift for a user
   */
  async getActiveShift(tenantId, userId) {
    const activeShift = await CashRegister.findOne({
      where: {
        tenant_id: tenantId,
        user_id: userId,
        status: 'open'
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    if (!activeShift) {
      return null;
    }

    // Add sales summary
    const salesSummary = await this._getSalesSummary(activeShift.id);

    return {
      ...activeShift.toJSON(),
      sales_summary: salesSummary
    };
  }

  /**
   * Get all active shifts for the tenant
   */
  async getActiveShifts(tenantId) {
    return await CashRegister.findAll({
      where: {
        tenant_id: tenantId,
        status: 'open'
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [['opened_at', 'ASC']]
    });
  }

  /**
   * Update cash in drawer when a sale is completed
   */
  async updateCashInDrawer(shiftId, amount, paymentMethod) {
    if (paymentMethod === 'cash' && amount > 0) {
      const shift = await CashRegister.findByPk(shiftId);
      if (shift && shift.status === 'open') {
        const newCashAmount = parseFloat(shift.cash_in_drawer) + parseFloat(amount);
        const newExpectedAmount = parseFloat(shift.expected_amount) + parseFloat(amount);
        
        await shift.update({
          cash_in_drawer: newCashAmount,
          expected_amount: newExpectedAmount
        });
      }
    }
  }

  /**
   * Get sales summary for a shift
   */
  async _getSalesSummary(shiftId) {
    const salesStats = await Sale.findOne({
      where: {
        cash_register_id: shiftId,
        status: 'completed'
      },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'total_sales'],
        [sequelize.fn('SUM', sequelize.col('total')), 'total_amount'],
        [sequelize.fn('SUM', 
          sequelize.literal("CASE WHEN payment_method = 'cash' THEN total ELSE 0 END")
        ), 'cash_sales'],
        [sequelize.fn('SUM', 
          sequelize.literal("CASE WHEN payment_method = 'card' THEN total ELSE 0 END")
        ), 'card_sales'],
        [sequelize.fn('SUM', 
          sequelize.literal("CASE WHEN payment_method = 'transfer' THEN total ELSE 0 END")
        ), 'transfer_sales'],
        [sequelize.fn('SUM', 
          sequelize.literal("CASE WHEN payment_method = 'credit' THEN total ELSE 0 END")
        ), 'credit_sales']
      ],
      raw: true
    });

    return {
      total_sales: parseInt(salesStats?.total_sales || 0),
      total_amount: parseFloat(salesStats?.total_amount || 0),
      cash_sales: parseFloat(salesStats?.cash_sales || 0),
      card_sales: parseFloat(salesStats?.card_sales || 0),
      transfer_sales: parseFloat(salesStats?.transfer_sales || 0),
      credit_sales: parseFloat(salesStats?.credit_sales || 0)
    };
  }
}

module.exports = new CashRegisterService();