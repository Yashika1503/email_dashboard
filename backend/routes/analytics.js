/**
 * Analytics Routes
 * GET /api/analytics/overview     → Summary stats
 * GET /api/analytics/volume       → Email volume over time
 * GET /api/analytics/senders      → Top senders
 * GET /api/analytics/labels       → Label/category breakdown
 * GET /api/analytics/hourly       → Hourly distribution
 */
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const db = require('../services/database');
const logger = require('../utils/logger');

router.use(requireAuth);

// ── Overview / Summary ────────────────────────────────────────────
router.get('/overview', (req, res) => {
    try {
        const userId = req.session.userId;
        const readStats = db.getReadStats(userId);
        const topSenders = db.getTopSenders(userId, 3);
        const recentVolume = db.getVolumeByDay(userId, 7);
        const syncStatus = require('../services/gmailFetch').getSyncStatus(userId);

        // Calculate 7-day email count
        const recentCount = recentVolume.reduce((sum, d) => sum + d.count, 0);

        // Calculate previous 7 days for comparison
        const prevVolume = db.getVolumeByDay(userId, 14);
        const prevCount = prevVolume.slice(0, prevVolume.length - recentVolume.length)
            .reduce((sum, d) => sum + d.count, 0);

        const volumeChange = prevCount > 0
            ? Math.round(((recentCount - prevCount) / prevCount) * 100)
            : 0;

        res.json({
            totalEmails: readStats?.total || 0,
            unreadCount: readStats?.unread_count || 0,
            readCount: readStats?.read_count || 0,
            sentCount: readStats?.sent_count || 0,
            readRate: readStats?.total > 0
                ? Math.round((readStats.read_count / readStats.total) * 100)
                : 0,
            last7Days: recentCount,
            volumeChange,
            topSenders: topSenders.slice(0, 3),
            syncStatus
        });
    } catch (err) {
        logger.error('Analytics overview error:', err);
        res.status(500).json({ error: 'Failed to fetch overview' });
    }
});

// ── Email Volume Over Time ────────────────────────────────────────
router.get('/volume', (req, res) => {
    try {
        const { period = 'daily', range = 30 } = req.query;
        const userId = req.session.userId;
        const rangeNum = Math.min(365, Math.max(7, parseInt(range)));

        let data;
        if (period === 'weekly') {
            data = db.getVolumeByWeek(userId, Math.ceil(rangeNum / 7));
        } else if (period === 'monthly') {
            data = db.getVolumeByMonth(userId, Math.ceil(rangeNum / 30));
        } else {
            data = db.getVolumeByDay(userId, rangeNum);
        }

        res.json({ period, range: rangeNum, data });
    } catch (err) {
        logger.error('Volume analytics error:', err);
        res.status(500).json({ error: 'Failed to fetch volume data' });
    }
});

// ── Top Senders ───────────────────────────────────────────────────
router.get('/senders', (req, res) => {
    try {
        const { limit = 15 } = req.query;
        const limitNum = Math.min(50, Math.max(5, parseInt(limit)));
        const senders = db.getTopSenders(req.session.userId, limitNum);
        res.json({ senders });
    } catch (err) {
        logger.error('Senders analytics error:', err);
        res.status(500).json({ error: 'Failed to fetch senders' });
    }
});

// ── Label / Category Breakdown ────────────────────────────────────
router.get('/labels', (req, res) => {
    try {
        const labels = db.getLabelBreakdown(req.session.userId);

        // Map Gmail system labels to friendly names
        const LABEL_NAMES = {
            'INBOX': 'Inbox',
            'SENT': 'Sent',
            'DRAFT': 'Drafts',
            'UNREAD': 'Unread',
            'STARRED': 'Starred',
            'IMPORTANT': 'Important',
            'TRASH': 'Trash',
            'SPAM': 'Spam',
            'CATEGORY_PERSONAL': 'Personal',
            'CATEGORY_SOCIAL': 'Social',
            'CATEGORY_PROMOTIONS': 'Promotions',
            'CATEGORY_UPDATES': 'Updates',
            'CATEGORY_FORUMS': 'Forums'
        };

        const mapped = labels.map(l => ({
            label: LABEL_NAMES[l.label] || l.label,
            rawLabel: l.label,
            count: l.count
        }));

        res.json({ labels: mapped });
    } catch (err) {
        logger.error('Labels analytics error:', err);
        res.status(500).json({ error: 'Failed to fetch labels' });
    }
});

// ── Hourly Distribution ───────────────────────────────────────────
router.get('/hourly', (req, res) => {
    try {
        const data = db.getHourlyDistribution(req.session.userId);
        // Fill missing hours with 0
        const full = Array.from({ length: 24 }, (_, h) => ({
            hour: h,
            count: data.find(d => d.hour === h)?.count || 0
        }));
        res.json({ data: full });
    } catch (err) {
        logger.error('Hourly analytics error:', err);
        res.status(500).json({ error: 'Failed to fetch hourly data' });
    }
});

module.exports = router;