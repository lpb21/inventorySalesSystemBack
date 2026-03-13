/**
 * Supplier Service
 * Handles supplier business logic
 */
const { Op } = require('sequelize');
const { Supplier, Product, Tenant } = require('../models');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { getPaginationSkip, formatPagination } = require('../utils/helpers');
const auditService = require('./auditService');
const cacheService = require('./cacheService');

const SUPPLIERS_CACHE_TTL = 60; // 1 minute

class SupplierService {
  /**
   * Get all suppliers with pagination and filters
   */
  async getSuppliers(tenantId, options = {}) {
    const {
      page = 1,
      limit = 10,
      search = '',
      is_active,
    } = options;

    // Build cache key
    const cacheKey = `suppliers:${tenantId}:${JSON.stringify(options)}`;
    
    // Try to get from cache
    try {
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        console.log('🚀 [CACHE HIT] Suppliers data loaded from Redis:', cacheKey);
        return cached;
      } else {
        console.log('💾 [CACHE MISS] Suppliers data will be loaded from database:', cacheKey);
      }
    } catch (error) {
      console.warn('⚠️  [CACHE ERROR] Redis unavailable, loading from database:', error.message);
    }

    const where = { tenant_id: tenantId };

    // By default, only show active suppliers
    if (is_active === undefined) {
      where.is_active = true;
    } else if (is_active !== '') {
      where.is_active = is_active === 'true';
    }

    // Add search filter
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { contact_name: { [Op.iLike]: `%${search}%` } },
        { phone: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { document: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const offset = getPaginationSkip(page, limit);

    const { count, rows } = await Supplier.findAndCountAll({
      where,
      offset,
      limit: parseInt(limit),
      order: [['name', 'ASC']],
      include: [
        {
          model: Product,
          as: 'products',
          attributes: ['id', 'name'],
          required: false
        }
      ]
    });

    const result = {
      suppliers: rows.map(supplier => ({
        ...supplier.toJSON(),
        product_count: supplier.products ? supplier.products.length : 0
      })),
      pagination: formatPagination(page, limit, count)
    };

    // Cache result
    try {
      await cacheService.set(cacheKey, result, SUPPLIERS_CACHE_TTL);
      console.log('✅ [CACHE SAVE] Suppliers data saved to Redis for', SUPPLIERS_CACHE_TTL, 'seconds');
    } catch (error) {
      console.warn('❌ [CACHE ERROR] Failed to save suppliers to Redis:', error.message);
    }

    return result;
  }

  /**
   * Get supplier by ID
   */
  async getSupplierById(tenantId, supplierId) {
    const supplier = await Supplier.findOne({
      where: { id: supplierId, tenant_id: tenantId },
      include: [
        {
          model: Product,
          as: 'products',
          attributes: ['id', 'name', 'sku', 'price', 'stock'],
          where: { is_active: true },
          required: false
        }
      ]
    });

    if (!supplier) {
      throw new NotFoundError('Proveedor no encontrado');
    }

    return {
      ...supplier.toJSON(),
      product_count: supplier.products ? supplier.products.length : 0
    };
  }

  /**
   * Create new supplier
   */
  async createSupplier(tenantId, supplierData, userId) {
    const normalizedData = {
      ...supplierData,
      document: typeof supplierData.document === 'string' ? supplierData.document.trim() : supplierData.document,
      email: typeof supplierData.email === 'string' ? supplierData.email.trim().toLowerCase() : supplierData.email,
    };

    // Check supplier limit for tenant plan (if any)
    const tenant = await Tenant.findByPk(tenantId);
    if (tenant.plan === 'basic') {
      const supplierCount = await Supplier.count({ where: { tenant_id: tenantId } });
      if (supplierCount >= 50) { // Assuming basic plan limit
        throw new ValidationError('Límite de proveedores alcanzado para el plan básico');
      }
    }

    // Check for unique document within tenant
    if (normalizedData.document) {
      const existingDocument = await Supplier.findOne({
        where: { tenant_id: tenantId, document: normalizedData.document },
      });
      if (existingDocument) {
        throw new ValidationError('Ya existe un proveedor con este documento');
      }
    }

    // Check for unique email within tenant (if provided)
    if (normalizedData.email) {
      const existingEmail = await Supplier.findOne({
        where: { tenant_id: tenantId, email: normalizedData.email },
      });
      if (existingEmail) {
        throw new ValidationError('Ya existe un proveedor con este email');
      }
    }

    const supplier = await Supplier.create({
      ...normalizedData,
      tenant_id: tenantId,
    });

    // Log audit
    await auditService.log({
      tenantId,
      userId,
      entityType: 'Supplier',
      entityId: supplier.id,
      action: 'create',
      changes: {
        new: {
          name: supplier.name,
          document: supplier.document,
          contact_name: supplier.contact_name,
          email: supplier.email,
          phone: supplier.phone
        }
      },
      description: `Proveedor "${supplier.name}" creado`
    });

    // Invalidate suppliers list cache
    this.invalidateCache(tenantId);

    return supplier;
  }

  /**
   * Update supplier
   */
  async updateSupplier(tenantId, supplierId, supplierData, userId) {
    const supplier = await Supplier.findOne({
      where: { id: supplierId, tenant_id: tenantId },
    });

    if (!supplier) {
      throw new NotFoundError('Proveedor no encontrado');
    }

    // Store old data for audit
    const oldData = {
      name: supplier.name,
      contact_name: supplier.contact_name,
      document: supplier.document,
      email: supplier.email,
      phone: supplier.phone,
      is_active: supplier.is_active
    };

    const normalizedData = {
      ...supplierData,
      document: typeof supplierData.document === 'string' ? supplierData.document.trim() : supplierData.document,
      email: typeof supplierData.email === 'string' ? supplierData.email.trim().toLowerCase() : supplierData.email,
    };

    const currentDocument = typeof supplier.document === 'string' ? supplier.document.trim() : supplier.document;
    const currentEmail = typeof supplier.email === 'string' ? supplier.email.trim().toLowerCase() : supplier.email;

    // Check unique constraints if being updated
    if (normalizedData.document && normalizedData.document !== currentDocument) {
      const existingDocument = await Supplier.findOne({
        where: { 
          tenant_id: tenantId, 
          document: normalizedData.document,
          id: { [Op.ne]: supplierId } 
        },
      });
      if (existingDocument) {
        throw new ValidationError('Ya existe otro proveedor con este documento');
      }
    }

    if (normalizedData.email && normalizedData.email !== currentEmail) {
      const existingEmail = await Supplier.findOne({
        where: { 
          tenant_id: tenantId, 
          email: normalizedData.email,
          id: { [Op.ne]: supplierId } 
        },
      });
      if (existingEmail) {
        throw new ValidationError('Ya existe otro proveedor con este email');
      }
    }

    await supplier.update(normalizedData);

    // Log audit
    await auditService.log({
      tenantId,
      userId,
      entityType: 'Supplier',
      entityId: supplier.id,
      action: 'update',
      changes: {
        old: oldData,
        new: {
          name: supplier.name,
          contact_name: supplier.contact_name,
          document: supplier.document,
          email: supplier.email,
          phone: supplier.phone,
          is_active: supplier.is_active
        }
      },
      description: `Proveedor "${supplier.name}" actualizado`
    });

    // Invalidate cache
    this.invalidateCache(tenantId);

    return supplier;
  }

  /**
   * Delete supplier (soft delete)
   */
  async deleteSupplier(tenantId, supplierId, userId) {
    const supplier = await Supplier.findOne({
      where: { id: supplierId, tenant_id: tenantId },
      include: [
        {
          model: Product,
          as: 'products',
          attributes: ['id'],
          required: false
        }
      ]
    });

    if (!supplier) {
      throw new NotFoundError('Proveedor no encontrado');
    }

    // Check if supplier has products
    if (supplier.products && supplier.products.length > 0) {
      throw new ValidationError('No se puede eliminar un proveedor que tiene productos asociados');
    }

    // Soft delete
    await supplier.update({ is_active: false });

    // Log audit
    await auditService.log({
      tenantId,
      userId,
      entityType: 'Supplier',
      entityId: supplier.id,
      action: 'delete',
      changes: {
        old: {
          name: supplier.name,
          document: supplier.document,
          is_active: supplier.is_active
        },
        new: {
          is_active: false
        }
      },
      description: `Proveedor "${supplier.name}" eliminado (soft delete)`
    });

    // Invalidate cache
    this.invalidateCache(tenantId);

    return { message: 'Proveedor eliminado exitosamente' };
  }

  /**
   * Toggle supplier status (active/inactive)
   */
  async toggleSupplierStatus(tenantId, supplierId, userId) {
    const supplier = await Supplier.findOne({
      where: { id: supplierId, tenant_id: tenantId },
      include: [
        {
          model: Product,
          as: 'products',
          attributes: ['id'],
          required: false,
        },
      ],
    });

    if (!supplier) {
      throw new NotFoundError('Proveedor no encontrado');
    }

    const oldStatus = supplier.is_active;
    const newStatus = !oldStatus;

    // Prevent deactivation when supplier has associated products
    if (oldStatus === true && newStatus === false && supplier.products && supplier.products.length > 0) {
      throw new ValidationError('No se puede desactivar un proveedor que tiene productos asociados');
    }

    await supplier.update({ is_active: newStatus });

    // Log audit
    await auditService.log({
      tenantId,
      userId,
      entityType: 'Supplier',
      entityId: supplier.id,
      action: newStatus ? 'activate' : 'deactivate',
      changes: {
        old: { is_active: oldStatus },
        new: { is_active: newStatus }
      },
      description: `Proveedor "${supplier.name}" ${newStatus ? 'activado' : 'desactivado'}`
    });

    // Invalidate cache
    this.invalidateCache(tenantId);

    return {
      ...supplier.toJSON(),
      status_changed: true,
      previous_status: oldStatus ? 'active' : 'inactive',
      current_status: newStatus ? 'active' : 'inactive'
    };
  }

  /**
   * Find or create supplier by name for import operations
   */
  async findOrCreateSupplierByName(tenantId, supplierName, additionalData = {}) {
    if (!supplierName || supplierName.trim() === '') {
      return null;
    }

    // Try to find existing supplier
    let supplier = await Supplier.findOne({
      where: { 
        tenant_id: tenantId, 
        name: { [Op.iLike]: supplierName.trim() },
        is_active: true
      },
    });

    if (!supplier) {
      // Create new supplier
      supplier = await Supplier.create({
        tenant_id: tenantId,
        name: supplierName.trim(),
        contact_name: additionalData.contact_name || null,
        document: additionalData.document || null,
        email: additionalData.email || null,
        phone: additionalData.phone || null,
        address: additionalData.address || null,
        notes: `Creado automáticamente durante importación de productos`,
        is_active: true
      });
    }

    return supplier;
  }

  /**
   * Get suppliers for dropdown/select
   */
  async getSuppliersForSelect(tenantId) {
    const cacheKey = `suppliers:select:${tenantId}`;
    
    try {
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        console.log('🚀 [CACHE HIT] Suppliers select data loaded from Redis');
        return cached;
      } else {
        console.log('💾 [CACHE MISS] Suppliers select data will be loaded from database');
      }
    } catch (error) {
      console.warn('⚠️  [CACHE ERROR] Redis unavailable for suppliers select:', error.message);
    }

    const suppliers = await Supplier.findAll({
      where: { tenant_id: tenantId, is_active: true },
      attributes: ['id', 'name', 'document', 'contact_name'],
      order: [['name', 'ASC']]
    });

    const result = suppliers.map(supplier => ({
      id: supplier.id,
      name: supplier.name,
      display_name: supplier.document ? 
        `${supplier.name} (${supplier.document})` : 
        supplier.name,
      contact_name: supplier.contact_name
    }));

    try {
      await cacheService.set(cacheKey, result, SUPPLIERS_CACHE_TTL);
      console.log('✅ [CACHE SAVE] Suppliers select data saved to Redis');
    } catch (error) {
      console.warn('❌ [CACHE ERROR] Failed to save suppliers select to Redis:', error.message);
    }

    return result;
  }

  /**
   * Invalidate cache for tenant suppliers
   */
  invalidateCache(tenantId) {
    console.log('🗑️  [CACHE CLEAR] Invalidating suppliers cache for tenant:', tenantId);
    cacheService.invalidate(`suppliers:${tenantId}:*`).catch((err) => {
      console.warn('❌ [CACHE ERROR] Failed to invalidate suppliers cache:', err.message);
    });
    cacheService.invalidate(`suppliers:select:${tenantId}`).catch((err) => {
      console.warn('❌ [CACHE ERROR] Failed to invalidate suppliers select cache:', err.message);
    });
  }
}

module.exports = new SupplierService();