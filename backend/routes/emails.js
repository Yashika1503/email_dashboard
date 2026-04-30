const express = require('express');
const router = express.Router();
const { syncEmails, getSyncStatus } = require('../services/gmailFetch');
const db = require('../services/database');

// ─────────────────────────────────────────────
// AUTH MIDDLEWARE
// ─────────────────────────────────────────────
function requireAuth(req, res, next) {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
}

router.use(requireAuth);

// ─────────────────────────────────────────────
// EMAIL ROUTES
// ─────────────────────────────────────────────

// GET /api/emails — paginated + filtered list from DB
router.get('/', (req, res) => {
    try {
        const userId = req.session.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        const search = req.query.search || '';
        const sender = req.query.sender || '';
        const startDate = req.query.startDate || '';
        const endDate = req.query.endDate || '';

        const emails = db.getEmails(userId, limit, offset, { search, sender, startDate, endDate });
        const total = db.getEmailCount(userId, { search, sender, startDate, endDate });

        res.json({
            emails,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error('Failed to fetch emails:', err);
        res.status(500).json({ error: 'Failed to fetch emails' });
    }
});

// POST /api/emails/sync — trigger background sync
router.post('/sync', (req, res) => {
    console.log('[Route] Sync hit, session:', req.session?.userId);  // ← ADD
    const userId = req.session.userId;
    const sessionTokens = req.session.tokens;
    syncEmails(userId, sessionTokens);
    res.json({ status: 'started' });
});

// GET /api/emails/sync/status
router.get('/sync/status', (req, res) => {
    const userId = req.session.userId;
    const status = getSyncStatus(userId);
    res.json(status);
});

// ─────────────────────────────────────────────
// ANALYTICS ROUTES
// ─────────────────────────────────────────────

// GET /api/emails/analytics/overview
router.get('/analytics/overview', (req, res) => {
    try {
        const userId = req.session.userId;
        const stats = db.getReadStats(userId);

        const now = new Date();
        const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
        const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();

        const last7 = db.getCountSince(userId, sevenDaysAgo);
        const prev7 = db.getCountBetween(userId, fourteenDaysAgo, sevenDaysAgo);

        const volumeChange = prev7 === 0
            ? 0
            : Math.round(((last7 - prev7) / prev7) * 100);

        const readRate = stats.total === 0
            ? 0
            : Math.round((stats.read_count / stats.total) * 100);

        res.json({
            totalEmails: stats.total,
            unreadCount: stats.unread_count,
            readCount: stats.read_count,
            sentCount: stats.sent_count,
            last7Days: last7,
            volumeChange,
            readRate
        });
    } catch (err) {
        console.error('Overview error:', err);
        res.status(500).json({ error: 'Failed to load overview' });
    }
});

// GET /api/emails/analytics/volume?period=daily|weekly|monthly
router.get('/analytics/volume', (req, res) => {
    try {
        const userId = req.session.userId;
        const period = req.query.period || 'daily';

        let data;
        if (period === 'daily') {
            data = db.getVolumeByDay(userId, 30);
        } else if (period === 'weekly') {
            data = db.getVolumeByWeek(userId, 12);
        } else {
            data = db.getVolumeByMonth(userId, 6);
        }

        res.json({ period, data });
    } catch (err) {
        console.error('Volume error:', err);
        res.status(500).json({ error: 'Failed to load volume' });
    }
});

// GET /api/emails/analytics/senders
router.get('/analytics/senders', (req, res) => {
    try {
        const userId = req.session.userId;
        const senders = db.getTopSenders(userId, 10);
        res.json({ senders });
    } catch (err) {
        console.error('Senders error:', err);
        res.status(500).json({ error: 'Failed to load senders' });
    }
});

// GET /api/emails/analytics/labels
router.get('/analytics/labels', (req, res) => {
    try {
        const userId = req.session.userId;
        const labels = db.getLabelBreakdown(userId);
        res.json({ labels });
    } catch (err) {
        console.error('Labels error:', err);
        res.status(500).json({ error: 'Failed to load labels' });
    }
});

// GET /api/emails/analytics/hourly
router.get('/analytics/hourly', (req, res) => {
    try {
        const userId = req.session.userId;
        const data = db.getHourlyDistribution(userId);

        // Fill all 24 hours (some may be missing)
        const hourMap = {};
        data.forEach(row => { hourMap[parseInt(row.hour)] = row.count; });
        const filled = Array.from({ length: 24 }, (_, h) => ({
            hour: h,
            count: hourMap[h] || 0
        }));

        res.json({ data: filled });
    } catch (err) {
        console.error('Hourly error:', err);
        res.status(500).json({ error: 'Failed to load hourly data' });
    }
});

module.exports = router;