/**
 * SMS Routes (tenant)
 * /v1/sms
 * La gestión de créditos (superadmin) vive en adminRoutes.js.
 */
const express = require('express');
const router = express.Router();
const smsController = require('../../controllers/smsController');
const authMiddleware = require('../../middlewares/authMiddleware');
const tenantMiddleware = require('../../middlewares/tenantMiddleware');

router.use(authMiddleware);
router.use(tenantMiddleware);

// GET /v1/sms/status - saldo y estado de SMS del tenant (cualquier rol: el POS lo usa)
router.get('/status', smsController.getStatus);

module.exports = router;
