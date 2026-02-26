/**
 * Customer Routes
 * /v1/customers
 */
const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middlewares/authMiddleware');

// All routes require authentication
router.use(authMiddleware);

// Routes will be implemented when Customer model is ready
// For now, return empty array as placeholder
router.get('/', (req, res) => {
  res.status(200).json({ success: true, data: [] });
});

router.post('/', (req, res) => {
  res.status(201).json({ success: true, data: {} });
});

router.get('/:id', (req, res) => {
  res.status(200).json({ success: true, data: {} });
});

router.put('/:id', (req, res) => {
  res.status(200).json({ success: true, data: {} });
});

router.delete('/:id', (req, res) => {
  res.status(200).json({ success: true, data: { message: 'Customer deleted' } });
});

module.exports = router;
