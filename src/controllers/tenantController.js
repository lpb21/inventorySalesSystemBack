/**
 * Tenant Controller
 * Handles tenant endpoints
 */
const { Tenant, User } = require('../models');
const { asyncHandler, formatResponse } = require('../utils/helpers');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { AuthorizationError, NotFoundError, ValidationError } = require('../utils/errors');
const tenantMiddleware = require('../middlewares/tenantMiddleware');
const auditService = require('../services/auditService');

// Datos del negocio que el propietario puede editar desde Configuración.
const UPDATABLE_TENANT_FIELDS = ['business_name', 'address', 'phone'];

const isSuperadmin = (req) => Boolean(req.user?.isSuperadmin || req.user?.role === 'superadmin');

class TenantController {
  /**
   * POST /v1/tenants
   * Create new tenant with owner user (superadmin only)
   */
  createTenant = asyncHandler(async (req, res, next) => {
    const {
      name,
      slug,
      business_name,
      email,
      address,
      phone,
      plan,
      subscription_end_date,
      owner_name,
      owner_email,
      owner_password
    } = req.body;

    // Validate required fields (handled by Joi validation middleware)
    // But we keep this check as backup
    if (!name || !slug || !owner_name || !owner_email || !owner_password) {
      return res.status(400).json(formatResponse(null, 'Faltan campos requeridos: name, slug, owner_name, owner_email, owner_password'));
    }

    if (!address) {
      return res.status(400).json(formatResponse(null, 'La dirección es requerida'));
    }

    if (!phone) {
      return res.status(400).json(formatResponse(null, 'El teléfono es requerido'));
    }

    if (!plan) {
      return res.status(400).json(formatResponse(null, 'El plan es requerido'));
    }

    if (!subscription_end_date) {
      return res.status(400).json(formatResponse(null, 'La fecha de terminación es requerida'));
    }

    // Check if tenant slug already exists
    const existingTenant = await Tenant.findOne({ where: { slug } });
    if (existingTenant) {
      return res.status(409).json(formatResponse(null, 'Ya existe un tenant con ese slug'));
    }

    // Check if owner email already exists
    const existingUser = await User.findOne({ where: { email: owner_email } });
    if (existingUser) {
      return res.status(409).json(formatResponse(null, 'Ya existe un usuario con ese email'));
    }

    // Parse the subscription end date
    let trialEndsAt;
    try {
      trialEndsAt = new Date(subscription_end_date);
      if (isNaN(trialEndsAt.getTime())) {
        return res.status(400).json(formatResponse(null, 'La fecha de terminación tiene un formato inválido'));
      }
    } catch (error) {
      return res.status(400).json(formatResponse(null, 'La fecha de terminación tiene un formato inválido'));
    }

    // Create tenant with the provided data
    const tenant = await Tenant.create({
      id: uuidv4(),
      name,
      slug,
      business_name: business_name || name,
      email: email || owner_email,
      address: address,
      phone: phone,
      plan: plan,
      subscription_status: 'active',
      is_active: true
    });

    // Create owner user
    const passwordHash = await bcrypt.hash(owner_password, 12);
    const user = await User.create({
      id: uuidv4(),
      tenant_id: tenant.id,
      name: owner_name,
      email: owner_email,
      password_hash: passwordHash,
      role: 'owner',
      is_active: true,
      is_superadmin: false
    });

    res.status(201).json(formatResponse({
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        business_name: tenant.business_name,
        address: tenant.address,
        phone: tenant.phone,
        plan: tenant.plan,
        subscription_status: tenant.subscription_status,
      },
      owner: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    }, 'Tenant creado exitosamente'));
  });

  /**
   * GET /v1/tenants
   * List all tenants (superadmin only)
   */
  getTenants = asyncHandler(async (req, res, next) => {
    const tenants = await Tenant.findAll({
      attributes: { exclude: ['created_at', 'updated_at'] }
    });

    res.status(200).json(formatResponse(tenants));
  });

  /**
   * GET /v1/tenants/:id
   * Get tenant by ID
   */
  getTenantById = asyncHandler(async (req, res, next) => {
    let tenant;

    if (req.params.id === 'current') {
      tenant = req.tenant;
    } else {
      // Solo el superadmin puede consultar otras empresas
      if (!isSuperadmin(req) && req.params.id !== req.tenantId) {
        throw new AuthorizationError('No puedes consultar otra empresa');
      }
      tenant = await Tenant.findByPk(req.params.id);
    }

    if (!tenant) {
      return res.status(404).json(formatResponse(null, 'Empresa no encontrada'));
    }

    res.status(200).json(formatResponse(tenant));
  });

  /**
   * PUT /v1/tenants/:id  (id = 'current' para la empresa del usuario)
   * Actualiza los datos del negocio. Solo owner (su propia empresa) o superadmin.
   *
   * Lista blanca de campos: antes se hacía tenant.update(req.body) y cualquier
   * usuario podía cambiar sms_balance, sms_enabled, subscription_status, plan...
   * de cualquier empresa. Esos campos solo se cambian desde los endpoints de admin.
   */
  updateTenant = asyncHandler(async (req, res, next) => {
    const tenantId = req.params.id === 'current' ? req.tenantId : req.params.id;
    if (!tenantId) {
      throw new ValidationError('Este usuario no pertenece a una empresa');
    }
    if (!isSuperadmin(req) && tenantId !== req.tenantId) {
      throw new AuthorizationError('No puedes modificar otra empresa');
    }

    const tenant = await Tenant.findByPk(tenantId);
    if (!tenant) {
      throw new NotFoundError('Empresa no encontrada');
    }

    const changes = {};
    UPDATABLE_TENANT_FIELDS.forEach((field) => {
      if (req.body[field] !== undefined) changes[field] = req.body[field];
    });
    if (typeof changes.business_name === 'string') changes.business_name = changes.business_name.trim();

    const before = {};
    Object.keys(changes).forEach((field) => { before[field] = tenant[field]; });

    await tenant.update(changes);
    await tenantMiddleware.invalidateTenantCache(tenantId);

    await auditService.log({
      tenantId,
      userId: req.user.userId,
      entityType: 'tenant',
      entityId: tenantId,
      action: 'update',
      changes: { before, after: changes },
      description: 'Datos del negocio actualizados',
    });

    res.status(200).json(formatResponse({
      id: tenant.id,
      name: tenant.name,
      business_name: tenant.business_name,
      address: tenant.address,
      phone: tenant.phone,
    }));
  });

  /**
   * DELETE /v1/tenants/:id
   * Delete tenant (soft delete)
   */
  deleteTenant = asyncHandler(async (req, res, next) => {
    const tenant = await Tenant.findByPk(req.params.id);

    if (!tenant) {
      return res.status(404).json(formatResponse(null, 'Tenant not found'));
    }

    await tenant.update({ is_active: false });

    res.status(200).json(formatResponse({ message: 'Tenant deleted successfully' }));
  });
}

module.exports = new TenantController();
