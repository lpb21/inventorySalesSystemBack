/**
 * Audit Service
 * Handles audit logging functionality
 */
const { AuditLog, User } = require('../models');

class AuditService {
  /**
   * Log an audit entry
   */
  async log({
    tenantId,
    userId,
    entityType,
    entityId,
    action,
    changes = null,
    description = null,
    ipAddress = null,
    userAgent = null,
  }) {
    try {
      await AuditLog.create({
        tenant_id: tenantId,
        user_id: userId,
        entity_type: entityType,
        entity_id: entityId,
        action,
        changes,
        description,
        ip_address: ipAddress,
        user_agent: userAgent,
      });
    } catch (error) {
      // Log error but don't break the main flow
      console.error('Audit log error:', error.message);
    }
  }

  /**
   * Log product creation
   */
  async logProductCreate({ tenantId, userId, product, ipAddress, userAgent }) {
    await this.log({
      tenantId,
      userId,
      entityType: 'Product',
      entityId: product.id,
      action: 'create',
      changes: {
        new: {
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          price: product.price,
          cost: product.cost,
          stock: product.stock,
        },
      },
      description: `Producto "${product.name}" creado`,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log product update with price/cost changes detection
   */
  async logProductUpdate({ tenantId, userId, product, oldData, newData, ipAddress, userAgent }) {
    const changes = {};
    const priceChanged = oldData.price !== newData.price;
    const costChanged = oldData.cost !== newData.cost;

    // Track all field changes
    for (const key in newData) {
      if (oldData[key] !== newData[key]) {
        changes[key] = {
          old: oldData[key],
          new: newData[key],
        };
      }
    }

    // Determine action type
    let action = 'update';
    if (priceChanged || costChanged) {
      action = 'price_change';
    }

    await this.log({
      tenantId,
      userId,
      entityType: 'Product',
      entityId: product.id,
      action,
      changes,
      description: `Producto "${product.name}" actualizado${priceChanged ? ' (cambio de precio)' : ''}${costChanged ? ' (cambio de costo)' : ''}`,
      ipAddress,
      userAgent,
    });

    // Also log price change separately if both price and cost changed
    if (priceChanged) {
      await this.log({
        tenantId,
        userId,
        entityType: 'Product',
        entityId: product.id,
        action: 'price_change',
        changes: {
          price: { old: oldData.price, new: newData.price },
        },
        description: `Precio del producto "${product.name}" cambiado de ${oldData.price} a ${newData.price}`,
        ipAddress,
        userAgent,
      });
    }

    if (costChanged) {
      await this.log({
        tenantId,
        userId,
        entityType: 'Product',
        entityId: product.id,
        action: 'cost_change',
        changes: {
          cost: { old: oldData.cost, new: newData.cost },
        },
        description: `Costo del producto "${product.name}" cambiado de ${oldData.cost} a ${newData.cost}`,
        ipAddress,
        userAgent,
      });
    }
  }

  /**
   * Log product deletion (soft delete)
   */
  async logProductDelete({ tenantId, userId, product, ipAddress, userAgent }) {
    await this.log({
      tenantId,
      userId,
      entityType: 'Product',
      entityId: product.id,
      action: 'delete',
      changes: {
        old: {
          name: product.name,
          sku: product.sku,
          is_active: product.is_active,
        },
        new: {
          is_active: false,
        },
      },
      description: `Producto "${product.name}" eliminado`,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log user login
   */
  async logLogin({ tenantId, userId, user, ipAddress, userAgent }) {
    await this.log({
      tenantId,
      userId,
      entityType: 'User',
      entityId: user.id,
      action: 'login',
      description: `Usuario "${user.name}" inició sesión`,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log user logout
   */
  async logLogout({ tenantId, userId, user, ipAddress, userAgent }) {
    await this.log({
      tenantId,
      userId,
      entityType: 'User',
      entityId: user.id,
      action: 'logout',
      description: `Usuario "${user.name}" cerró sesión`,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log customer creation
   */
  async logCustomerCreate({ tenantId, userId, customer, ipAddress, userAgent }) {
    await this.log({
      tenantId,
      userId,
      entityType: 'Customer',
      entityId: customer.id,
      action: 'create',
      changes: {
        new: {
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
        },
      },
      description: `Cliente "${customer.name}" creado`,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log customer update
   */
  async logCustomerUpdate({ tenantId, userId, customer, oldData, newData, ipAddress, userAgent }) {
    const changes = {};
    for (const key in newData) {
      if (oldData[key] !== newData[key]) {
        changes[key] = {
          old: oldData[key],
          new: newData[key],
        };
      }
    }

    await this.log({
      tenantId,
      userId,
      entityType: 'Customer',
      entityId: customer.id,
      action: 'update',
      changes,
      description: `Cliente "${customer.name}" actualizado`,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log customer deletion
   */
  async logCustomerDelete({ tenantId, userId, customer, ipAddress, userAgent }) {
    await this.log({
      tenantId,
      userId,
      entityType: 'Customer',
      entityId: customer.id,
      action: 'delete',
      changes: {
        old: {
          name: customer.name,
          is_active: customer.is_active,
        },
        new: {
          is_active: false,
        },
      },
      description: `Cliente "${customer.name}" eliminado`,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log inventory movement (stock adjustments, sales, purchases, etc.)
   */
  async logInventoryMovement({ tenantId, userId, product, movement, ipAddress, userAgent }) {
    const actionLabels = {
      sale: 'Venta',
      purchase: 'Compra',
      adjustment: 'Ajuste',
      waste: 'Merma',
      return: 'Devolución',
      transfer: 'Transferencia',
    };

    const actionLabel = actionLabels[movement.type] || movement.type;

    await this.log({
      tenantId,
      userId,
      entityType: 'InventoryMovement',
      entityId: movement.id,
      action: 'stock_adjustment',
      changes: {
        product: {
          id: product.id,
          name: product.name,
        },
        movement: {
          type: movement.type,
          quantity: movement.quantity,
          stock_before: movement.stock_before,
          stock_after: movement.stock_after,
          reason: movement.reason,
        },
      },
      description: `${actionLabel}: ${movement.quantity} unidades de "${product.name}" (Stock: ${movement.stock_before} → ${movement.stock_after})${movement.reason ? ` - ${movement.reason}` : ''}`,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Get audit logs for a tenant
   */
  async getAuditLogs(tenantId, { 
    page = 1, 
    limit = 20, 
    entityType, 
    entityId, 
    action, 
    userId,
    startDate, 
    endDate 
  } = {}) {
    const { getPaginationSkip, formatPagination } = require('../utils/helpers');
    const { Op } = require('sequelize');

    const where = { tenant_id: tenantId };

    if (entityType) {
      where.entity_type = entityType;
    }

    if (entityId) {
      where.entity_id = entityId;
    }

    if (action) {
      where.action = action;
    }

    if (userId) {
      where.user_id = userId;
    }

    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) {
        where.created_at[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        where.created_at[Op.lte] = new Date(endDate);
      }
    }

    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      include: [
        { 
          model: User, 
          as: 'user', 
          attributes: ['id', 'name', 'email'] 
        },
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: getPaginationSkip(page, limit),
    });

    return {
      auditLogs: rows,
      pagination: formatPagination(page, limit, count),
    };
  }

    /**
   * Logs de TODOS los tenants (para el superadmin), paginado.
   * Trae el usuario que ejecutó la acción y el tenant afectado.
   */
  async getGlobalAuditLogs({ page = 1, limit = 30 } = {}) {
    const { getPaginationSkip, formatPagination } = require('../utils/helpers');
    const { Tenant } = require('../models');

    const { count, rows } = await AuditLog.findAndCountAll({
      include: [
        { model: User, as: 'user', attributes: ['id', 'name', 'email'] },
        { model: Tenant, as: 'tenant', attributes: ['id', 'name', 'business_name'] },
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: getPaginationSkip(page, limit),
    });

    return {
      auditLogs: rows,
      pagination: formatPagination(page, limit, count),
    };
  }

  /**
   * Get audit logs for a specific entity
   */
  async getEntityAuditLogs(tenantId, entityType, entityId) {
    const logs = await AuditLog.findAll({
      where: {
        tenant_id: tenantId,
        entity_type: entityType,
        entity_id: entityId,
      },
      include: [
        { 
          model: User, 
          as: 'user', 
          attributes: ['id', 'name', 'email'] 
        },
      ],
      order: [['created_at', 'DESC']],
    });

    return logs;
  }
}

module.exports = new AuditService();

