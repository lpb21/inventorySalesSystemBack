/**
 * Permission Middleware
 * Validates user permissions based on role
 */

// Role hierarchy (higher role includes lower role permissions)
const ROLE_HIERARCHY = {
  owner: ['owner', 'admin', 'supervisor', 'cashier', 'viewer'],
  admin: ['admin', 'supervisor', 'cashier', 'viewer'],
  supervisor: ['supervisor', 'cashier', 'viewer'],
  cashier: ['cashier', 'viewer'],
  viewer: ['viewer'],
  superadmin: ['owner', 'admin', 'supervisor', 'cashier', 'viewer', 'superadmin'],
};

// Permission definitions
const PERMISSIONS = {
  // Users management
  'users:create': ['owner', 'admin', 'superadmin'],
  'users:read': ['owner', 'admin', 'supervisor', 'superadmin'],
  'users:update': ['owner', 'admin', 'superadmin'],
  'users:delete': ['owner', 'superadmin'],
  'users:reset-password': ['owner', 'admin', 'superadmin'],
  
  // Products management
  'products:create': ['owner', 'admin', 'supervisor', 'superadmin'],
  'products:read': ['owner', 'admin', 'supervisor', 'cashier', 'viewer', 'superadmin'],
  'products:update': ['owner', 'admin', 'supervisor', 'superadmin'],
  'products:delete': ['owner', 'admin', 'superadmin'],
  'products:adjust-stock': ['owner', 'admin', 'supervisor', 'superadmin'],
  
  // Categories management
  'categories:create': ['owner', 'admin', 'superadmin'],
  'categories:read': ['owner', 'admin', 'supervisor', 'cashier', 'viewer', 'superadmin'],
  'categories:update': ['owner', 'admin', 'superadmin'],
  'categories:delete': ['owner', 'admin', 'superadmin'],
  
  // Sales (POS)
  'sales:create': ['owner', 'admin', 'supervisor', 'cashier', 'superadmin'],
  'sales:read': ['owner', 'admin', 'supervisor', 'cashier', 'viewer', 'superadmin'],
  'sales:cancel': ['owner', 'admin', 'supervisor', 'superadmin'],
  'sales:refund': ['owner', 'admin', 'superadmin'],
  
  // Inventory
  'inventory:read': ['owner', 'admin', 'supervisor', 'cashier', 'viewer', 'superadmin'],
  'inventory:adjust': ['owner', 'admin', 'supervisor', 'superadmin'],
  'inventory:movements': ['owner', 'admin', 'supervisor', 'superadmin'],
  
  // Reports
  'reports:read': ['owner', 'admin', 'supervisor', 'superadmin'],
  'reports:view-costs': ['owner', 'admin', 'superadmin'],
  'reports:export': ['owner', 'admin', 'supervisor', 'superadmin'],
  
  // Settings
  'settings:read': ['owner', 'admin', 'superadmin'],
  'settings:update': ['owner', 'admin', 'superadmin'],
  'settings:business': ['owner', 'superadmin'],
  
  // Suppliers
  'suppliers:create': ['owner', 'admin', 'superadmin'],
  'suppliers:read': ['owner', 'admin', 'supervisor', 'superadmin'],
  'suppliers:update': ['owner', 'admin', 'superadmin'],
  'suppliers:delete': ['owner', 'admin', 'superadmin'],
  
  // Customers
  'customers:create': ['owner', 'admin', 'supervisor', 'cashier', 'superadmin'],
  'customers:read': ['owner', 'admin', 'supervisor', 'cashier', 'viewer', 'superadmin'],
  'customers:update': ['owner', 'admin', 'supervisor', 'superadmin'],
  'customers:delete': ['owner', 'admin', 'superadmin'],
  
  // Purchase Orders
  'purchase-orders:create': ['owner', 'admin', 'superadmin'],
  'purchase-orders:read': ['owner', 'admin', 'supervisor', 'superadmin'],
  'purchase-orders:update': ['owner', 'admin', 'superadmin'],
  'purchase-orders:receive': ['owner', 'admin', 'supervisor', 'superadmin'],
  'purchase-orders:delete': ['owner', 'admin', 'superadmin'],
  
  // Cash Registers
  'cash-registers:create': ['owner', 'admin', 'superadmin'],
  'cash-registers:read': ['owner', 'admin', 'supervisor', 'cashier', 'superadmin'],
  'cash-registers:update': ['owner', 'admin', 'superadmin'],
  'cash-registers:open': ['owner', 'admin', 'supervisor', 'cashier', 'superadmin'],
  'cash-registers:close': ['owner', 'admin', 'supervisor', 'cashier', 'superadmin'],
  'cash-registers:delete': ['owner', 'admin', 'superadmin'],
};

/**
 * Check if user has specific permission
 */
const hasPermission = (userRole, permission) => {
  const allowedRoles = PERMISSIONS[permission];
  if (!allowedRoles) {
    // If permission not defined, only owner and superadmin can access
    return userRole === 'owner' || userRole === 'superadmin';
  }
  return allowedRoles.includes(userRole);
};

/**
 * Check if user has any of the given roles
 */
const hasRole = (userRole, requiredRoles) => {
  const allowedRoles = ROLE_HIERARCHY[userRole];
  if (!allowedRoles) return false;
  return requiredRoles.some(role => allowedRoles.includes(role));
};

/**
 * Middleware factory for permission checks
 */
const permissionMiddleware = (permission) => {
  return (req, res, next) => {
    try {
      
      const userRole = req.user.role;
      
      // Owner, admin and superadmin have all permissions
      if (hasRole(userRole, ['owner', 'admin', 'superadmin'])) {
        return next();
      }
      
      // Check specific permission
      if (!hasPermission(userRole, permission)) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'No tienes permiso para realizar esta acción',
          },
        });
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Middleware factory for role check
 */
const roleMiddleware = (allowedRoles) => {
  return (req, res, next) => {
    try {
      const userRole = req.user.role;
      
      if (!hasRole(userRole, allowedRoles)) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'No tienes el rol requerido para esta acción',
          },
        });
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = {
  permissionMiddleware,
  roleMiddleware,
  hasPermission,
  hasRole,
  PERMISSIONS,
};
