/**
 * Announcement Routes (public, authenticated)
 * Any logged-in user of any tenant can read the active announcement.
 * Writing/managing announcements lives under adminRoutes.js (superadmin only).
 */
const express = require('express');
const router = express.Router();
const announcementController = require('../../controllers/announcementController');
const authMiddleware = require('../../middlewares/authMiddleware');

router.use(authMiddleware);
router.get('/active', announcementController.getActive);

module.exports = router;
