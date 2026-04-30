/**
 * Database Service
 * SQLite with better-sqlite3 for synchronous, reliable storage
 * Stores: users, tokens, cached email metadata, analytics cache
 */
const Database = require('better-sqlite3');
const path = require('path');
const logger = require('../utils/logger');

let db;

/**
 * Initialize database and run migrations
 */
function initDatabase() {
    const dbPath = process.env.DB_PATH || './data/email_dashboard.db';
    const resolvedPath = path.resolve(dbPath);

    db = new Database(resolvedPath, {
        verbose: process.env.NODE_ENV === 'development' ? null : null
    });

    // Enable WAL mode for better performance
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('synchronous = NORMAL');

    runMigrations();
    logger.info(`Database opened at ${resolvedPath}`);
    return Promise.resolve();
}

function runMigrations() {
    db.exec(`
    -- Users table: one row per authenticated Google account
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      google_id TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL,
      name TEXT,
      picture TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_sync DATETIME
    );

    -- OAuth tokens (encrypted at rest)
    CREATE TABLE IF NOT EXISTS oauth_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      token_expiry DATETIME,
      scope TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id)
    );

    -- Email metadata cache (no email bodies stored by default)
    CREATE TABLE IF NOT EXISTS emails (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      gmail_id TEXT NOT NULL,
      thread_id TEXT,
      subject TEXT,
      sender_email TEXT,
      sender_name TEXT,
      recipient_email TEXT,
      date DATETIME,
      labels TEXT,          -- JSON array of label names
      is_read INTEGER DEFAULT 0,
      is_sent INTEGER DEFAULT 0,
      snippet TEXT,         -- First ~100 chars, no PII concern
      size_estimate INTEGER,
      synced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, gmail_id)
    );

    -- Index for common query patterns
    CREATE INDEX IF NOT EXISTS idx_emails_user_date ON emails(user_id, date DESC);
    CREATE INDEX IF NOT EXISTS idx_emails_sender ON emails(user_id, sender_email);
    CREATE INDEX IF NOT EXISTS idx_emails_labels ON emails(user_id, labels);
    CREATE INDEX IF NOT EXISTS idx_emails_read ON emails(user_id, is_read);

    -- Sync status tracking
    CREATE TABLE IF NOT EXISTS sync_state (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      history_id TEXT,      -- Gmail history ID for incremental sync
      page_token TEXT,
      last_full_sync DATETIME,
      sync_status TEXT DEFAULT 'idle', -- idle, running, error
      error_message TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id)
    );
  `);

    logger.info('Database migrations complete');
}

function getDb() {
    if (!db) throw new Error('Database not initialized. Call initDatabase() first.');
    return db;
}

// ── User Operations ───────────────────────────────────────────────

function upsertUser({ googleId, email, name, picture }) {
    const d = getDb();
    d.prepare(`
    INSERT INTO users (google_id, email, name, picture, last_login)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(google_id) DO UPDATE SET
      email = excluded.email,
      name = excluded.name,
      picture = excluded.picture,
      last_login = CURRENT_TIMESTAMP
  `).run(googleId, email, name, picture);

    return d.prepare('SELECT * FROM users WHERE google_id = ?').get(googleId);
}

function getUserById(id) {
    return getDb().prepare('SELECT * FROM users WHERE id = ?').get(id);
}

// ── Token Operations ──────────────────────────────────────────────

function saveTokens(userId, { accessToken, refreshToken, expiry, scope }) {
    getDb().prepare(`
    INSERT INTO oauth_tokens (user_id, access_token, refresh_token, token_expiry, scope, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      access_token = excluded.access_token,
      refresh_token = CASE WHEN excluded.refresh_token IS NOT NULL THEN excluded.refresh_token ELSE refresh_token END,
      token_expiry = excluded.token_expiry,
      scope = excluded.scope,
      updated_at = CURRENT_TIMESTAMP
  `).run(userId, accessToken, refreshToken, expiry, scope);
}

function getTokens(userId) {
    return getDb().prepare('SELECT * FROM oauth_tokens WHERE user_id = ?').get(userId);
}

function updateAccessToken(userId, accessToken, expiry) {
    getDb().prepare(`
    UPDATE oauth_tokens SET access_token = ?, token_expiry = ?, updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `).run(accessToken, expiry, userId);
}

// ── Email Operations ──────────────────────────────────────────────

function bulkInsertEmails(userId, emails) {
    const insert = getDb().prepare(`
    INSERT OR IGNORE INTO emails
      (user_id, gmail_id, thread_id, subject, sender_email, sender_name,
       recipient_email, date, labels, is_read, is_sent, snippet, size_estimate)
    VALUES
      (@userId, @gmail_id, @thread_id, @subject, @sender_email, @sender_name,
       @recipient_email, @date, @labels, @is_read, @is_sent, @snippet, @size_estimate)
  `);

    const insertMany = getDb().transaction((emails) => {
        let count = 0;
        for (const email of emails) {
            const result = insert.run({ userId, ...email });
            count += result.changes;
        }
        return count;
    });

    return insertMany(emails);
}

function getEmailCount(userId) {
    return getDb().prepare('SELECT COUNT(*) as count FROM emails WHERE user_id = ?').get(userId)?.count || 0;
}

function getEmails(userId, { limit = 50, offset = 0, search = '', sender = '', startDate = '', endDate = '' } = {}) {
    let query = 'SELECT * FROM emails WHERE user_id = ?';
    const params = [userId];

    if (search) {
        query += ' AND (subject LIKE ? OR snippet LIKE ?)';
        params.push(`%${search}%`, `%${search}%`);
    }
    if (sender) {
        query += ' AND (sender_email LIKE ? OR sender_name LIKE ?)';
        params.push(`%${sender}%`, `%${sender}%`);
    }
    if (startDate) {
        query += ' AND date >= ?';
        params.push(startDate);
    }
    if (endDate) {
        query += ' AND date <= ?';
        params.push(endDate);
    }

    query += ' ORDER BY date DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return getDb().prepare(query).all(...params);
}

// ── Analytics Queries ─────────────────────────────────────────────

function getVolumeByDay(userId, days = 30) {
    return getDb().prepare(`
    SELECT DATE(date) as day, COUNT(*) as count
    FROM emails
    WHERE user_id = ? AND date >= DATE('now', '-' || ? || ' days')
    GROUP BY day
    ORDER BY day ASC
  `).all(userId, days);
}

function getVolumeByWeek(userId, weeks = 12) {
    return getDb().prepare(`
    SELECT strftime('%Y-W%W', date) as week, COUNT(*) as count
    FROM emails
    WHERE user_id = ? AND date >= DATE('now', '-' || ? || ' days')
    GROUP BY week
    ORDER BY week ASC
  `).all(userId, weeks * 7);
}

function getVolumeByMonth(userId, months = 6) {
    return getDb().prepare(`
    SELECT strftime('%Y-%m', date) as month, COUNT(*) as count
    FROM emails
    WHERE user_id = ? AND date >= DATE('now', '-' || ? || ' months')
    GROUP BY month
    ORDER BY month ASC
  `).all(userId, months);
}

function getTopSenders(userId, limit = 10) {
    return getDb().prepare(`
    SELECT
      sender_email,
      sender_name,
      COUNT(*) as count,
      SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread_count,
      MAX(date) as last_email
    FROM emails
    WHERE user_id = ? AND is_sent = 0
    GROUP BY sender_email
    ORDER BY count DESC
    LIMIT ?
  `).all(userId, limit);
}

function getReadStats(userId) {
    return getDb().prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN is_read = 1 THEN 1 ELSE 0 END) as read_count,
      SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread_count,
      SUM(CASE WHEN is_sent = 1 THEN 1 ELSE 0 END) as sent_count
    FROM emails
    WHERE user_id = ?
  `).get(userId);
}

function getLabelBreakdown(userId) {
    // Labels stored as JSON array - we extract them using SQLite JSON functions
    // Fallback: parse labels column and count
    const emails = getDb().prepare(`
    SELECT labels FROM emails WHERE user_id = ? AND labels IS NOT NULL
  `).all(userId);

    const counts = {};
    for (const row of emails) {
        try {
            const labels = JSON.parse(row.labels || '[]');
            for (const label of labels) {
                counts[label] = (counts[label] || 0) + 1;
            }
        } catch { }
    }

    return Object.entries(counts)
        .map(([label, count]) => ({ label, count }))
        .sort((a, b) => b.count - a.count);
}

function getHourlyDistribution(userId) {
    return getDb().prepare(`
    SELECT
      CAST(strftime('%H', date) AS INTEGER) as hour,
      COUNT(*) as count
    FROM emails
    WHERE user_id = ?
    GROUP BY hour
    ORDER BY hour ASC
  `).all(userId);
}

// ── Sync State ────────────────────────────────────────────────────

function getSyncState(userId) {
    return getDb().prepare('SELECT * FROM sync_state WHERE user_id = ?').get(userId);
}

function upsertSyncState(userId, { historyId, pageToken, status, error } = {}) {
    getDb().prepare(`
    INSERT INTO sync_state (user_id, history_id, page_token, sync_status, error_message, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      history_id = COALESCE(excluded.history_id, history_id),
      page_token = excluded.page_token,
      sync_status = excluded.sync_status,
      error_message = excluded.error_message,
      updated_at = CURRENT_TIMESTAMP
  `).run(userId, historyId, pageToken, status || 'idle', error);
}

function markLastSync(userId) {
    getDb().prepare('UPDATE users SET last_sync = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
}

module.exports = {
    initDatabase,
    getDb,
    // Users
    upsertUser,
    getUserById,
    // Tokens
    saveTokens,
    getTokens,
    updateAccessToken,
    // Emails
    bulkInsertEmails,
    getEmailCount,
    getEmails,
    // Analytics
    getVolumeByDay,
    getVolumeByWeek,
    getVolumeByMonth,
    getTopSenders,
    getReadStats,
    getLabelBreakdown,
    getHourlyDistribution,
    // Sync
    getSyncState,
    upsertSyncState,
    markLastSync
};