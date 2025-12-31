// server/routes/admin.js
const express = require('express');
const User = require('../models/User');
const ChatHistory = require('../models/ChatHistory');
const { cacheMiddleware } = require('../middleware/cacheMiddleware');
const { redisClient } = require('../config/redisClient');
const LLMConfiguration = require('../models/LLMConfiguration'); 
const { auditLog } = require('../utils/logger');
const LLMPerformanceLog = require('../models/LLMPerformanceLog'); 
const AdminDocument = require('../models/AdminDocument');

const router = express.Router();

// This file now ONLY contains general admin routes that don't fit
// into more specific categories like 'courses' or 'documents'.

/* ====== Model feedback & LLM Config routes ======= */
router.get('/feedback-stats', async (req, res) => { /* ... implementation ... */ });
router.get('/llms', async (req, res) => { /* ... implementation ... */ });
router.post('/llms', async (req, res) => { /* ... implementation ... */ });
router.put('/llms/:id', async (req, res) => { /* ... implementation ... */ });
router.delete('/llms/:id', async (req, res) => { /* ... implementation ... */ });

/* ====== Dashboard & Key Management Routes ===== */
const CACHE_DURATION_SECONDS = 30;
router.get('/dashboard-stats', cacheMiddleware(CACHE_DURATION_SECONDS), async (req, res) => { /* ... implementation ... */ });
router.get('/key-requests', cacheMiddleware(CACHE_DURATION_SECONDS), async (req, res) => { /* ... implementation ... */ });
router.post("/key-requests/approve", async (req, res) => { /* ... implementation ... */ });
router.post("/key-requests/reject", async (req, res) => { /* ... implementation ... */ });

/* ====== User & Chat Management Routes ====== */
router.get('/users-with-chats', cacheMiddleware(CACHE_DURATION_SECONDS), async (req, res) => { /* ... implementation ... */ });
router.get('/negative-feedback', async (req, res) => { /* ... implementation ... */ });

module.exports = router;
