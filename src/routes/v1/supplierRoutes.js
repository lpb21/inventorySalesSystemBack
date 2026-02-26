/**
 * Supplier Routes
 * /v1/suppliers
 */
const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middlewares/authMiddleware');

// All routes require authentication
router.use(authMiddleware);

// Routes will be implemented when Supplier model is ready
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
  res.status(200).json({ success: true, data: { message: 'Supplier deleted' } });
});

module.exports = router;
