// server/routes/index.js
const express = require('express');
const router = express.Router();

// Import all the admin-specific routers
const adminCoreRoutes = require('./admin');
const datasetRoutes = require('./datasetRoutes');
const courseAdminRoutes = require('./courseAdmin');
const documentAdminRoutes = require('./documentAdmin');
const analyticsRoutes = require('./analytics');
const finetuningRoutes = require('./finetuning');

// --- THIS IS THE CRITICAL FIX ---
// Mount the most specific routes first. Express will check them in this order.
// Requests to /admin/documents/... will be handled by documentAdminRoutes.
router.use('/documents', documentAdminRoutes);
router.use('/courses', courseAdminRoutes);
router.use('/datasets', datasetRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/finetuning', finetuningRoutes);

// The generic routes (like /key-requests, /llms) are in adminCoreRoutes.
// Since it's mounted at '/', it acts as a fallback and MUST be last.
router.use('/', adminCoreRoutes);

module.exports = router;
