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
};

// Permission definitions
const PERMISSIONS = {
  // Users management
  'users:create': ['owner', 'admin'],
  'users:read': ['owner', 'admin', 'supervisor'],
  'users:update': ['owner', 'admin'],
  'users:delete': ['owner'],
  'users:reset-password': ['owner', 'admin'],
  
  // Products management
  'products:create': ['owner', 'admin', 'supervisor'],
  'products:read': ['owner', 'admin', 'supervisor', 'cashier', 'viewer'],
  'products:update': ['owner', 'admin', 'supervisor'],
  'products:delete': ['owner', 'admin'],
  'products:adjust-stock': ['owner', 'admin', 'supervisor'],
  
  // Categories management
  'categories:create': ['owner', 'admin'],
  'categories:read': ['owner', 'admin', 'supervisor', 'cashier', 'viewer'],
  'categories:update': ['owner', 'admin'],
  'categories:delete': ['owner', 'admin'],
  
  // Sales (POS)
  'sales:create': ['owner', 'admin', 'supervisor', 'cashier'],
  'sales:read': ['owner', 'admin', 'supervisor', 'cashier', 'viewer'],
  'sales:cancel': ['owner', 'admin', 'supervisor'],
  'sales:refund': ['owner', 'admin'],
  
  // Inventory
  'inventory:read': ['owner', 'admin', 'supervisor', 'cashier', 'viewer'],
  'inventory:adjust': ['owner', 'admin', 'supervisor'],
  'inventory:movements': ['owner', 'admin', 'supervisor'],
  
  // Reports
  'reports:read': ['owner', 'admin', 'supervisor'],
  'reports:view-costs': ['owner', 'admin'],
  'reports:export': ['owner', 'admin', 'supervisor'],
  
  // Settings
  'settings:read': ['owner', 'admin'],
  'settings:update': ['owner', 'admin'],
  'settings:business': ['owner'],
  
  // Suppliers
  'suppliers:create': ['owner', 'admin'],
  'suppliers:read': ['owner', 'admin', 'supervisor'],
  'suppliers:update': ['owner', 'admin'],
  'suppliers:delete': ['owner', 'admin'],
  
  // Customers
  'customers:create': ['owner', 'admin', 'supervisor', 'cashier'],
  'customers:read': ['owner', 'admin', 'supervisor', 'cashier', 'viewer'],
  'customers:update': ['owner', 'admin', 'supervisor'],
  'customers:delete': ['owner', 'admin'],
  
  // Purchase Orders
  'purchase-orders:create': ['owner', 'admin'],
  'purchase-orders:read': ['owner', 'admin', 'supervisor'],
  'purchase-orders:update': ['owner', 'admin'],
  'purchase-orders:receive': ['owner', 'admin', 'supervisor'],
  'purchase-orders:delete': ['owner', 'admin'],
  
  // Cash Registers
  'cash-registers:create': ['owner', 'admin'],
  'cash-registers:read': ['owner', 'admin', 'supervisor', 'cashier'],
  'cash-registers:update': ['owner', 'admin'],
  'cash-registers:open': ['owner', 'admin', 'supervisor', 'cashier'],
  'cash-registers:close': ['owner', 'admin', 'supervisor', 'cashier'],
  'cash-registers:delete': ['owner', 'admin'],
};

/**
 * Check if user has specific permission
 */
const hasPermission = (userRole, permission) => {
  const allowedRoles = PERMISSIONS[permission];
  if (!allowedRoles) {
    // If permission not defined, only owner can access
    return userRole === 'owner';
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
      
      // Owner and admin have all permissions
      if (hasRole(userRole, ['owner', 'admin'])) {
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
