/**
 * Email Routes
 * GET /api/emails          → Paginated email list with search/filter
 * GET /api/emails/sync     → Get sync status
 * POST /api/emails/sync    → Trigger manual sync
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { getEmails, getEmailCount } = require('../services/database');
const { syncEmails, getSyncStatus } = require('../services/gmailFetch');
const logger = require('../utils/logger');

// All email routes require authentication
router.use(requireAuth);

// ── List emails with pagination and filtering ─────────────────────
router.get('/', (req, res) => {
    try {
        const {
            page = 1,
            limit = 50,
            search = '',
            sender = '',
            startDate = '',
            endDate = ''
        } = req.query;

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const offset = (pageNum - 1) * limitNum;

        const emails = getEmails(req.session.userId, {
            limit: limitNum,
            offset,
            search,
            sender,
            startDate,
            endDate
        });

        const total = getEmailCount(req.session.userId);

        res.json({
            emails,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        });
    } catch (err) {
        logger.error('Error fetching emails:', err);
        res.status(500).json({ error: 'Failed to fetch emails' });
    }
});

// ── Get sync status ───────────────────────────────────────────────
router.get('/sync', (req, res) => {
    try {
        const status = getSyncStatus(req.session.userId);
        res.json(status);
    } catch (err) {
        logger.error('Error getting sync status:', err);
        res.status(500).json({ error: 'Failed to get sync status' });
    }
});

// ── Trigger manual sync ───────────────────────────────────────────
router.post('/sync', async (req, res) => {
    try {
        // Return immediately, sync runs in background
        res.json({ message: 'Sync started', status: 'running' });

        // Run sync asynchronously
        syncEmails(req.session.userId)
            .then(result => logger.info(`Manual sync complete for user ${req.session.userId}:`, result))
            .catch(err => logger.error(`Manual sync failed for user ${req.session.userId}:`, err));
    } catch (err) {
        logger.error('Error starting sync:', err);
        res.status(500).json({ error: 'Failed to start sync' });
    }
});

module.exports = router;