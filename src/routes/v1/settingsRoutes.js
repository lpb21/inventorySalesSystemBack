/**
 * Settings Routes
 * /v1/settings
 */
const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middlewares/authMiddleware');

// All routes require authentication
router.use(authMiddleware);

// GET /v1/settings
router.get('/', (req, res) => {
  res.status(200).json({ 
    success: true, 
    data: {
      business_name: '',
      address: '',
      phone: '',
      plan: 'free'
    }
  });
});

// PUT /v1/settings
router.put('/', (req, res) => {
  res.status(200).json({ success: true, data: req.body });
});

// GET /v1/settings/business
router.get('/business', (req, res) => {
  res.status(200).json({ success: true, data: {} });
});

// PUT /v1/settings/business
router.put('/business', (req, res) => {
  res.status(200).json({ success: true, data: req.body });
});

module.exports = router;
