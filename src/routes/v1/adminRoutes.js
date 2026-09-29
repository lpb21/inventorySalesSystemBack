/**
 * Admin Routes
 * Todas las rutas aquí requieren autenticación Y rol superadmin.
 */
const express = require('express');
const router = express.Router();
const adminController = require('../../controllers/adminController');
const smsController = require('../../controllers/smsController');
const authMiddleware = require('../../middlewares/authMiddleware');
const { validate } = require('../../middlewares/validationMiddleware');
const {
  createAnnouncementSchema,
  updateAnnouncementSchema,
  setSmsEnabledSchema,
  addSmsCreditsSchema,
} = require('../../utils/validators');

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
router.post('/tenants/:id/reset-owner-password', adminController.resetOwnerPassword);
router.post('/tenants', adminController.createTenant);

router.get('/announcements', adminController.listAnnouncements);
router.post('/announcements', validate(createAnnouncementSchema), adminController.createAnnouncement);
router.put('/announcements/:id', validate(updateAnnouncementSchema), adminController.updateAnnouncement);
router.patch('/announcements/:id/toggle', adminController.toggleAnnouncement);

// SMS a clientes de fiado: habilitación y créditos prepago por tenant
router.get('/sms/overview', smsController.adminOverview);
router.post('/sms/balance-check', smsController.runBalanceCheck);
router.patch('/tenants/:id/sms', validate(setSmsEnabledSchema), smsController.setEnabled);
router.post('/tenants/:id/sms/welcome-bonus', smsController.grantWelcomeBonus);
router.post('/tenants/:id/sms/credits', validate(addSmsCreditsSchema), smsController.addCredits);
router.get('/tenants/:id/sms/transactions', smsController.listTransactions);
router.get('/tenants/:id/sms/logs', smsController.listLogs);

module.exports = router;