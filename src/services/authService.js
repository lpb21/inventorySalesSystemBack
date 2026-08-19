/**
 * Auth Service
 * Handles authentication logic
 */
const jwt = require('jsonwebtoken');
const { User, Tenant, TenantSubscription } = require('../models');
const { AuthenticationError, ConflictError, ValidationError } = require('../utils/errors');
const env = require('../config/env');
const plansConfig = require('../config/plans');

class AuthService {
  /**
   * Login user
   */
  async login(email, password) {

    let user = null;

    try {

      // Try to find user with tenant and subscription data
      user = await User.findOne({
        where: { email },
        include: [
          {
            model: Tenant,
            as: 'tenant',
            include: [
              {
                model: TenantSubscription,
                as: 'subscription',
                required: false // LEFT JOIN - algunos tenants pueden no tener suscripción aún
              }
            ]
          }
        ],
      });


    } catch (dbError) {

      try {

        // Fallback: simple query without subscription data
        user = await User.findOne({
          where: { email },
          include: [{ model: Tenant, as: 'tenant' }],
        });


      } catch (fallbackError) {

        // Last resort: query user without any includes
        try {
          user = await User.findOne({ where: { email } });

          if (user && user.tenant_id) {
            user.tenant = await Tenant.findByPk(user.tenant_id);
          }
        } catch (lastResortError) {
          throw new Error(`Database connection error: ${lastResortError.message}`);
        }
      }
    }


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

      // Check subscription status using the new billing system (if available)
      const subscription = user.tenant.subscription;


      if (subscription) {
        // Use tenant_subscriptions as source of truth
        const now = new Date();

        // Check if subscription is cancelled
        if (subscription.status === 'cancelled') {
          const planName = subscription.plan_code.toUpperCase();
          throw new AuthenticationError(
            `Tu suscripción al plan ${planName} ha sido cancelada. Por favor contacta a soporte o renueva tu plan.`
          );
        }

        // Check if subscription is past due
        if (subscription.status === 'past_due') {
          const planName = subscription.plan_code.toUpperCase();
          const gracePeriod = subscription.grace_until ? new Date(subscription.grace_until) : null;

          if (gracePeriod && gracePeriod > now) {
            // Still in grace period
            const daysLeft = Math.ceil((gracePeriod - now) / (1000 * 60 * 60 * 24));
            throw new AuthenticationError(
              `Tu pago del plan ${planName} está pendiente. Tienes ${daysLeft} día(s) de gracia para realizar el pago.`
            );
          } else {
            // Grace period expired
            throw new AuthenticationError(
              `Tu suscripción al plan ${planName} ha sido suspendida por falta de pago. Por favor renueva tu suscripción.`
            );
          }
        }

        // Check if subscription period has ended
        if (subscription.current_period_end) {
          const periodEnd = new Date(subscription.current_period_end);
          if (periodEnd < now && subscription.status !== 'active') {
            const day = String(periodEnd.getDate()).padStart(2, '0');
            const month = String(periodEnd.getMonth() + 1).padStart(2, '0');
            const year = periodEnd.getFullYear();
            const formattedDate = `${day}/${month}/${year}`;
            const planName = subscription.plan_code.toUpperCase();

            throw new AuthenticationError(
              `Tu suscripción al plan ${planName} venció el ${formattedDate}. Por favor renueva tu suscripción para continuar.`
            );
          }
        }
      } else {
        // No subscription found - this could be a legacy tenant or one that hasn't been migrated yet
        // Allow access but log for monitoring
      }
    }


    // Update last login
    await user.update({ last_login: new Date() });


    // Generate JWT token
    const token = this.generateToken(user);


    // Prepare tenant info with subscription details
    let tenantInfo = null;
    if (user.tenant) {
      tenantInfo = {
        id: user.tenant.id,
        name: user.tenant.name,
        business_name: user.tenant.business_name,
        plan: user.tenant.plan,
        limits: plansConfig[user.tenant.plan] || plansConfig.free,
        address: user.tenant.address,
        phone: user.tenant.phone,
      };

      // Add subscription info if available
      if (user.tenant.subscription) {
        tenantInfo.subscription = {
          status: user.tenant.subscription.status,
          plan_code: user.tenant.subscription.plan_code,
          current_period_end: user.tenant.subscription.current_period_end,
          provider: user.tenant.subscription.provider
        };
      }
    }


    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenant: tenantInfo,
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

  /**
   * Change own password
   * User must provide current password to change it
   */
  async changeOwnPassword(userId, currentPassword, newPassword) {
    const user = await User.findByPk(userId);

    if (!user) {
      throw new AuthenticationError('Usuario no encontrado');
    }

    // Validate current password
    const isValidPassword = await user.validatePassword(currentPassword);
    if (!isValidPassword) {
      throw new AuthenticationError('La contraseña actual es incorrecta');
    }

    // Validate new password strength
    if (newPassword.length < 6) {
      throw new ValidationError('La nueva contraseña debe tener al menos 6 caracteres');
    }

    if (currentPassword === newPassword) {
      throw new ValidationError('La nueva contraseña debe ser diferente a la actual');
    }

    // Update password
    await user.update({ password_hash: newPassword });

    return {
      message: 'Contraseña actualizada correctamente',
    };
  }

  /**
   * Reset user password (Admin/Owner only)
   * Allows owner/superadmin to reset password of another user
   */
  async resetUserPassword(adminUserId, targetUserId, newPassword) {
    const adminUser = await User.findByPk(adminUserId, {
      include: [{ model: Tenant, as: 'tenant' }],
    });

    if (!adminUser) {
      throw new AuthenticationError('Usuario administrador no encontrado');
    }

    const targetUser = await User.findByPk(targetUserId, {
      include: [{ model: Tenant, as: 'tenant' }],
    });

    if (!targetUser) {
      throw new ValidationError('Usuario objetivo no encontrado');
    }

    // Check permissions
    const isSuperadmin = adminUser.is_superadmin || adminUser.role === 'superadmin';
    const isOwner = adminUser.role === 'owner';

    if (!isSuperadmin && !isOwner) {
      throw new AuthenticationError('No tienes permisos para resetear contraseñas');
    }

    // Owner can only reset passwords within their tenant
    if (!isSuperadmin && adminUser.tenant_id !== targetUser.tenant_id) {
      throw new AuthenticationError('Solo puedes resetear contraseñas de usuarios de tu empresa');
    }

    // Prevent resetting superadmin password (unless you are superadmin)
    if (targetUser.is_superadmin && !isSuperadmin) {
      throw new AuthenticationError('No puedes resetear la contraseña de un superadmin');
    }

    // Validate new password strength
    if (newPassword.length < 6) {
      throw new ValidationError('La contraseña debe tener al menos 6 caracteres');
    }

    // Update password
    await targetUser.update({ password_hash: newPassword });

    return {
      message: `Contraseña de ${targetUser.name} (${targetUser.email}) actualizada correctamente`,
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
      },
    };
  }
}

module.exports = new AuthService();
