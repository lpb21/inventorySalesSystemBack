/**
 * Admin Routes
 * Todas las rutas aquí requieren autenticación Y rol superadmin.
 */
const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/adminController');
const authMiddleware = require('../../middlewares/authMiddleware');

// Guard de superadmin: bloquea a cualquiera que no sea superadmin
const superadminOnly = (req, res, next) => {
  if (!req.user || !req.user.isSuperadmin) {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'Acceso restringido a superadministradores' },
    });
  }
  next();
};

router.use(authMiddleware);   // debe estar autenticado
router.use(superadminOnly);   // y ser superadmin
router.get('/tenants', adminController.listTenants);
router.get('/audit-logs', adminController.auditLogs);
router.post('/tenants/:id/activate', adminController.activateTenant);
router.post('/tenants/:id/deactivate', adminController.deactivateTenant);


module.exports = router;