/**
 * Auth Service
 * Handles authentication logic
 */
const jwt = require('jsonwebtoken');
const { User, Tenant } = require('../models');
const { AuthenticationError, ConflictError, ValidationError } = require('../utils/errors');
const env = require('../config/env');
const plansConfig = require('../config/plans');

class AuthService {
  /**
   * Login user
   */
  async login(email, password) {
    // Find user by email
    const user = await User.findOne({
      where: { email },
      include: [{ model: Tenant, as: 'tenant' }],
    });

    if (!user) {
      throw new AuthenticationError('Credenciales inválidas');
    }

    // Check if user is active
    if (!user.is_active) {
      throw new AuthenticationError('Usuario inactivo');
    }

    // Validate password
    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      throw new AuthenticationError('Credenciales inválidas');
    }

    // Check if tenant is active (skip for superadmin who has null tenant_id)
    if (user.tenant_id && user.tenant) {
      if (!user.tenant.is_active) {
        throw new AuthenticationError('Empresa inactiva');
      }

      // Check if plan or trial period has expired
      const expirationDate = user.tenant.subscription_ends_at || user.tenant.trial_ends_at;
      if (expirationDate) {
        const expiresAt = new Date(expirationDate);
        if (expiresAt < new Date()) {
          const day = String(expiresAt.getDate()).padStart(2, '0');
          const month = String(expiresAt.getMonth() + 1).padStart(2, '0');
          const year = expiresAt.getFullYear();
          const formattedDate = `${day}/${month}/${year}`;

          const planName = user.tenant.plan.toUpperCase();
          const message = user.tenant.plan === 'free'
            ? `Tu plan ${planName} (Periodo de Prueba) ha expirado el día ${formattedDate}`
            : `Tu plan ${planName} ha vencido el día ${formattedDate}. Por favor renueva tu suscripción.`;
          throw new AuthenticationError(message);
        }
      }
    }

    // Update last login
    await user.update({ last_login: new Date() });

    // Generate JWT token
    const token = this.generateToken(user);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenant: user.tenant ? {
          id: user.tenant.id,
          name: user.tenant.name,
          business_name: user.tenant.business_name,
          plan: user.tenant.plan,
          limits: plansConfig[user.tenant.plan] || plansConfig.free,
          address: user.tenant.address,
          phone: user.tenant.phone,
        } : null,
      },
    };
  }

  /**
   * Register new tenant with owner user
   */
  async register(data) {
    const { email, password, name, business_name, slug } = data;

    // Check if slug already exists
    const existingTenant = await Tenant.findOne({ where: { slug } });
    if (existingTenant) {
      throw new ConflictError('El identificador de empresa ya está en uso');
    }

    // Check if email already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      throw new ConflictError('El correo electrónico ya está registrado');
    }

    // Create tenant and owner user in transaction
    const { sequelize } = require('../models');
    const transaction = await sequelize.transaction();

    try {
      // Create tenant
      const tenant = await Tenant.create({
        name: business_name,
        slug,
        business_name,
        plan: 'free',
        max_products: 100,
        max_users: 1,
      }, { transaction });

      // Create owner user
      const user = await User.create({
        tenant_id: tenant.id,
        email,
        password_hash: password,
        name,
        role: 'owner',
        is_active: true,
      }, { transaction });

      await transaction.commit();

      // Generate JWT token
      const token = this.generateToken(user);

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenant: {
            id: tenant.id,
            name: tenant.name,
            business_name: tenant.business_name,
            plan: tenant.plan,
            limits: plansConfig[tenant.plan] || plansConfig.free,
            address: tenant.address,
            phone: tenant.phone,
          },
        },
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser(userId) {
    const user = await User.findByPk(userId, {
      include: [{ model: Tenant, as: 'tenant' }],
    });

    if (!user) {
      throw new AuthenticationError('Usuario no encontrado');
    }

    // For superadmin users (no tenant), return null tenant
    const tenantInfo = user.tenant ? {
      id: user.tenant.id,
      name: user.tenant.name,
      business_name: user.tenant.business_name,
      plan: user.tenant.plan,
      limits: plansConfig[user.tenant.plan] || plansConfig.free,
      address: user.tenant.address,
      phone: user.tenant.phone,
    } : null;

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      is_active: user.is_active,
      last_login: user.last_login,
      tenant: tenantInfo,
    };
  }

  /**
   * Generate JWT token
   */
  generateToken(user) {
    const payload = {
      userId: user.id,
      tenantId: user.tenant_id,
      role: user.role,
      email: user.email,
    };

    return jwt.sign(payload, env.jwt.secret, {
      expiresIn: env.jwt.expiresIn,
    });
  }

  /**
   * Refresh token
   */
  async refreshToken(token) {
    try {
      const decoded = jwt.verify(token, env.jwt.secret);
      const user = await User.findByPk(decoded.userId);

      if (!user || !user.is_active) {
        throw new AuthenticationError('Usuario no válido');
      }

      return this.generateToken(user);
    } catch (error) {
      throw new AuthenticationError('Token inválido');
    }
  }
}

module.exports = new AuthService();
