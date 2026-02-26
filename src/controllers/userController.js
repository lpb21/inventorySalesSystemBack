/**
 * User Controller
 * Handles user management endpoints
 */
const { User, Tenant } = require('../models');
const { NotFoundError, ConflictError, ValidationError } = require('../utils/errors');
const { asyncHandler } = require('../utils/helpers');
const { formatResponse } = require('../utils/helpers');
const { getPaginationSkip, formatPagination } = require('../utils/helpers');

class UserController {
  /**
   * GET /v1/users
   * List all users for tenant
   */
  getUsers = asyncHandler(async (req, res, next) => {
    const { page = 1, limit = 20 } = req.query;
    
    const { count, rows } = await User.findAndCountAll({
      where: { tenant_id: req.tenantId },
      attributes: { exclude: ['password_hash'] },
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: getPaginationSkip(page, limit),
    });

    res.status(200).json(formatResponse({
      users: rows,
      pagination: formatPagination(page, limit, count),
    }));
  });

  /**
   * POST /v1/users
   * Create new user
   */
  createUser = asyncHandler(async (req, res, next) => {
    const tenant = await Tenant.findByPk(req.tenantId);
    const userCount = await User.count({ where: { tenant_id: req.tenantId } });
    
    if (userCount >= tenant.max_users) {
      throw new ValidationError(`Límite de usuarios alcanzado para el plan ${tenant.plan}`);
    }

    const { email, password, name, role, is_active } = req.body;

    // Check if email already exists
    const existingUser = await User.findOne({
      where: { tenant_id: req.tenantId, email },
    });

    if (existingUser) {
      throw new ConflictError('El correo electrónico ya está en uso');
    }

    const user = await User.create({
      tenant_id: req.tenantId,
      email,
      password_hash: password,
      name,
      role,
      is_active: is_active !== false,
    });

    res.status(201).json(formatResponse({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        is_active: user.is_active,
      },
    }));
  });

  /**
   * GET /v1/users/:id
   * Get user by ID
   */
  getUserById = asyncHandler(async (req, res, next) => {
    const user = await User.findOne({
      where: { id: req.params.id, tenant_id: req.tenantId },
      attributes: { exclude: ['password_hash'] },
    });

    if (!user) {
      throw new NotFoundError('Usuario no encontrado');
    }

    res.status(200).json(formatResponse(user));
  });

  /**
   * PUT /v1/users/:id
   * Update user
   */
  updateUser = asyncHandler(async (req, res, next) => {
    const user = await User.findOne({
      where: { id: req.params.id, tenant_id: req.tenantId },
    });

    if (!user) {
      throw new NotFoundError('Usuario no encontrado');
    }

    // Prevent changing own role if owner
    if (user.role === 'owner' && req.user.role !== 'owner') {
      throw new ValidationError('No puedes modificar un usuario owner');
    }

    const { name, email, role, is_active } = req.body;

    // Check email uniqueness
    if (email && email !== user.email) {
      const existingUser = await User.findOne({
        where: { tenant_id: req.tenantId, email },
      });
      if (existingUser) {
        throw new ConflictError('El correo electrónico ya está en uso');
      }
    }

    await user.update({
      name: name || user.name,
      email: email || user.email,
      role: role || user.role,
      is_active: is_active !== undefined ? is_active : user.is_active,
    });

    res.status(200).json(formatResponse({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        is_active: user.is_active,
      },
    }));
  });

  /**
   * DELETE /v1/users/:id
   * Delete user
   */
  deleteUser = asyncHandler(async (req, res, next) => {
    const user = await User.findOne({
      where: { id: req.params.id, tenant_id: req.tenantId },
    });

    if (!user) {
      throw new NotFoundError('Usuario no encontrado');
    }

    // Prevent deleting owner
    if (user.role === 'owner') {
      throw new ValidationError('No puedes eliminar el usuario owner');
    }

    // Prevent self-delete
    if (user.id === req.user.userId) {
      throw new ValidationError('No puedes eliminar tu propio usuario');
    }

    await user.update({ is_active: false });

    res.status(200).json(formatResponse({ message: 'Usuario eliminado correctamente' }));
  });

  /**
   * PUT /v1/users/:id/reset-password
   * Reset user password
   */
  resetPassword = asyncHandler(async (req, res, next) => {
    const user = await User.findOne({
      where: { id: req.params.id, tenant_id: req.tenantId },
    });

    if (!user) {
      throw new NotFoundError('Usuario no encontrado');
    }

    const { password } = req.body;

    await user.update({ password_hash: password });

    res.status(200).json(formatResponse({ message: 'Contraseña actualizada correctamente' }));
  });

  /**
   * PUT /v1/users/:id/toggle-status
   * Toggle user active status
   */
  toggleStatus = asyncHandler(async (req, res, next) => {
    const user = await User.findOne({
      where: { id: req.params.id, tenant_id: req.tenantId },
    });

    if (!user) {
      throw new NotFoundError('Usuario no encontrado');
    }

    // Prevent toggling owner
    if (user.role === 'owner') {
      throw new ValidationError('No puedes desactivar el usuario owner');
    }

    // Prevent self-toggle
    if (user.id === req.user.userId) {
      throw new ValidationError('No puedes desactivar tu propio usuario');
    }

    await user.update({ is_active: !user.is_active });

    res.status(200).json(formatResponse({
      user: {
        id: user.id,
        is_active: user.is_active,
      },
    }));
  });
}

module.exports = new UserController();
