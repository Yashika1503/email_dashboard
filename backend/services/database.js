const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, '../data/email_dashboard.db');
const db = new Database(dbPath);

// ─────────────────────────────────────────────
// TABLE SETUP
// ─────────────────────────────────────────────

// ✅ FIX 1: Added missing `tokens` table
db.exec(`
CREATE TABLE IF NOT EXISTS tokens (
    user_id TEXT PRIMARY KEY,
    access_token TEXT,
    refresh_token TEXT,
    token_expiry TEXT,
    scope TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

// ✅ FIX 2: Removed stray token columns + added missing comma after token_expiry
db.exec(`
CREATE TABLE IF NOT EXISTS emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    gmail_id TEXT UNIQUE,
    thread_id TEXT,
    subject TEXT,
    sender TEXT,
    recipient TEXT,
    date TEXT,
    snippet TEXT,
    labels TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

function saveTokens(userId, tokens) {
    const stmt = db.prepare(`
        INSERT OR REPLACE INTO tokens
        (user_id, access_token, refresh_token, token_expiry)
        VALUES (?, ?, ?, ?)
    `);

    stmt.run(
        userId,
        tokens.accessToken,
        tokens.refreshToken,
        tokens.expiry
    );
}

function getTokens(userId) {
    return db.prepare(`
        SELECT * FROM tokens WHERE user_id = ?
    `).get(userId);
}

function updateAccessToken(userId, accessToken, expiry) {
    db.prepare(`
        UPDATE tokens
        SET access_token = ?, token_expiry = ?
        WHERE user_id = ?
    `).run(accessToken, expiry, userId);
}

// ─────────────────────────────────────────────
// SAVE EMAIL
// ─────────────────────────────────────────────
function saveEmail(email) {
    const stmt = db.prepare(`
        INSERT OR IGNORE INTO emails 
        (user_id, gmail_id, thread_id, subject, sender, recipient, date, snippet, labels)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
        email.userId,
        email.gmailId,
        email.threadId,
        email.subject,
        email.from,
        email.to,
        email.date,
        email.snippet,
        email.labelIds
    );
}

// ─────────────────────────────────────────────
// FETCH EMAILS — with optional filtering
// ─────────────────────────────────────────────
function getEmails(userId, limit = 50, offset = 0, filters = {}) {
    const { search = '', sender = '', startDate = '', endDate = '' } = filters;

    const conditions = ['user_id = ?'];
    const params = [userId];

    if (search) {
        conditions.push('(subject LIKE ? OR snippet LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
    }
    if (sender) {
        conditions.push('sender LIKE ?');
        params.push(`%${sender}%`);
    }
    if (startDate) {
        conditions.push('date >= ?');
        params.push(startDate);
    }
    if (endDate) {
        conditions.push('date <= ?');
        params.push(endDate + 'T23:59:59Z');
    }

    const where = conditions.join(' AND ');

    return db.prepare(`
        SELECT 
            id, gmail_id, thread_id, subject,
            sender AS sender_email,
            -- Extract name from "Name <email>" format
            CASE 
                WHEN sender LIKE '%<%' 
                THEN TRIM(SUBSTR(sender, 1, INSTR(sender, '<') - 1))
                ELSE sender 
            END AS sender_name,
            recipient, date, snippet, labels,
            CASE WHEN labels NOT LIKE '%UNREAD%' THEN 1 ELSE 0 END AS is_read
        FROM emails
        WHERE ${where}
        ORDER BY date DESC
        LIMIT ? OFFSET ?
    `).all(...params, limit, offset);
}

// ─────────────────────────────────────────────
// COUNT EMAILS (for pagination)
// ─────────────────────────────────────────────
function getEmailCount(userId, filters = {}) {
    const { search = '', sender = '', startDate = '', endDate = '' } = filters;

    const conditions = ['user_id = ?'];
    const params = [userId];

    if (search) {
        conditions.push('(subject LIKE ? OR snippet LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
    }
    if (sender) {
        conditions.push('sender LIKE ?');
        params.push(`%${sender}%`);
    }
    if (startDate) {
        conditions.push('date >= ?');
        params.push(startDate);
    }
    if (endDate) {
        conditions.push('date <= ?');
        params.push(endDate + 'T23:59:59Z');
    }

    const where = conditions.join(' AND ');
    return db.prepare(`SELECT COUNT(*) as count FROM emails WHERE ${where}`).get(...params).count;
}

// ─────────────────────────────────────────────
// ANALYTICS HELPERS
// ─────────────────────────────────────────────

function getReadStats(userId) {
    return db.prepare(`
        SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN labels LIKE '%UNREAD%' THEN 1 ELSE 0 END) as unread_count,
            SUM(CASE WHEN labels NOT LIKE '%UNREAD%' THEN 1 ELSE 0 END) as read_count,
            SUM(CASE WHEN labels LIKE '%SENT%' THEN 1 ELSE 0 END) as sent_count
        FROM emails
        WHERE user_id = ?
    `).get(userId);
}

function getCountSince(userId, since) {
    return db.prepare(`
        SELECT COUNT(*) as count FROM emails
        WHERE user_id = ? AND date >= ?
    `).get(userId, since).count;
}

function getCountBetween(userId, from, to) {
    return db.prepare(`
        SELECT COUNT(*) as count FROM emails
        WHERE user_id = ? AND date >= ? AND date < ?
    `).get(userId, from, to).count;
}

// Volume per day (last N days)
function getVolumeByDay(userId, days = 30) {
    return db.prepare(`
        SELECT 
            DATE(date) as day,
            COUNT(*) as count
        FROM emails
        WHERE user_id = ?
        AND date >= date('now', ?)
        GROUP BY day
        ORDER BY day ASC
    `).all(userId, `-${days} days`);
}

// Volume per ISO week (last N weeks)
function getVolumeByWeek(userId, weeks = 12) {
    return db.prepare(`
        SELECT 
            strftime('%Y-W%W', date) as week,
            COUNT(*) as count
        FROM emails
        WHERE user_id = ?
        AND date >= date('now', ?)
        GROUP BY week
        ORDER BY week ASC
    `).all(userId, `-${weeks * 7} days`);
}

// Volume per month (last N months)
function getVolumeByMonth(userId, months = 6) {
    return db.prepare(`
        SELECT 
            strftime('%Y-%m', date) as month,
            COUNT(*) as count
        FROM emails
        WHERE user_id = ?
        AND date >= date('now', ?)
        GROUP BY month
        ORDER BY month ASC
    `).all(userId, `-${months} months`);
}

// Top senders — parse name + email from "Name <email>" format
function getTopSenders(userId, limit = 10) {
    const rows = db.prepare(`
        SELECT sender, COUNT(*) as count
        FROM emails
        WHERE user_id = ?
        GROUP BY sender
        ORDER BY count DESC
        LIMIT ?
    `).all(userId, limit);

    return rows.map(row => {
        const match = row.sender?.match(/^(.*?)\s*<(.+?)>$/);
        return {
            sender_name: match ? match[1].trim() : null,
            sender_email: match ? match[2] : row.sender,
            count: row.count
        };
    });
}

// Label breakdown — split comma-joined labels
function getLabelBreakdown(userId) {
    const rows = db.prepare(`
        SELECT labels FROM emails WHERE user_id = ?
    `).all(userId);

    const map = {};
    rows.forEach(row => {
        const labels = row.labels?.split(',') || [];
        labels.forEach(l => {
            const clean = l.trim();
            if (!clean) return;
            if (!map[clean]) map[clean] = 0;
            map[clean]++;
        });
    });

    // Map raw Gmail label IDs to friendly names
    const FRIENDLY = {
        'INBOX': 'Inbox',
        'SENT': 'Sent',
        'UNREAD': 'Unread',
        'IMPORTANT': 'Important',
        'STARRED': 'Starred',
        'CATEGORY_PROMOTIONS': 'Promotions',
        'CATEGORY_SOCIAL': 'Social',
        'CATEGORY_UPDATES': 'Updates',
        'CATEGORY_FORUMS': 'Forums',
        'CATEGORY_PERSONAL': 'Personal',
    };

    return Object.entries(map)
        .map(([label, count]) => ({
            label: FRIENDLY[label] || label,
            count
        }))
        .sort((a, b) => b.count - a.count);
}

// Hourly distribution
function getHourlyDistribution(userId) {
    return db.prepare(`
        SELECT 
            strftime('%H', date) as hour,
            COUNT(*) as count
        FROM emails
        WHERE user_id = ?
        GROUP BY hour
        ORDER BY hour
    `).all(userId);
}

// ─────────────────────────────────────────────

module.exports = {
    saveEmail,
    getEmails,
    getEmailCount,
    getReadStats,
    getCountSince,
    getCountBetween,
    getVolumeByDay,
    getVolumeByWeek,
    getVolumeByMonth,
    getTopSenders,
    getLabelBreakdown,
    getHourlyDistribution,
    saveTokens,
    getTokens,
    updateAccessToken
};