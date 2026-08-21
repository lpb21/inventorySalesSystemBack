/**
 * Routes Index
 * Combines all route modules (already under /v1/ prefix from app.js)
 */
const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./v1/authRoutes');
const userRoutes = require('./v1/userRoutes');
const categoryRoutes = require('./v1/categoryRoutes');
const productRoutes = require('./v1/productRoutes');
const inventoryRoutes = require('./v1/inventoryRoutes');
const saleRoutes = require('./v1/saleRoutes');
const reportRoutes = require('./v1/reportRoutes');
const tenantRoutes = require('./v1/tenantRoutes');
const customerRoutes = require('./v1/customerRoutes');
const supplierRoutes = require('./v1/supplierRoutes');
const settingsRoutes = require('./v1/settingsRoutes');
const cashRegisterRoutes = require('./v1/cashRegisterRoutes');
const billingRoutes = require('./v1/billingRoutes');
const adminRoutes = require('./v1/adminRoutes');

// Mount routes (without /v1/ prefix since it's added in app.js)
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/tenants', tenantRoutes);
router.use('/categories', categoryRoutes);
router.use('/products', productRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/sales', saleRoutes);
router.use('/reports', reportRoutes);
router.use('/customers', customerRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/cash-registers', cashRegisterRoutes);
router.use('/settings', settingsRoutes);
router.use('/billing', billingRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
