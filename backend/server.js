/**
 * Email Analytics Dashboard - Backend Server
 * Secure Gmail API integration with OAuth2
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const ConnectSQLite = require('connect-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('./utils/logger');
const { initDatabase } = require('./services/database');
const { scheduleSyncJobs } = require('./services/syncScheduler');

// Route imports
const authRoutes = require('./routes/auth');
const emailRoutes = require('./routes/emails');
const analyticsRoutes = require('./routes/analytics');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Ensure data directory exists ──────────────────────────────────
const dataDir = path.dirname(process.env.DB_PATH || './data/email_dashboard.db');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    logger.info(`Created data directory: ${dataDir}`);
}

// ── Security Middleware ───────────────────────────────────────────
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Rate limiting - prevent abuse
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,                   // max 100 requests per window
    message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// CORS - only allow frontend origin
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true, // required for session cookies
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// ── Session Configuration with SQLite Store ───────────────────────
const SQLiteStore = ConnectSQLite(session);
app.use(session({
    store: new SQLiteStore({
        db: 'sessions.db',
        dir: dataDir,
        table: 'sessions'
    }),
    secret: process.env.SESSION_SECRET || (() => {
        logger.warn('SESSION_SECRET not set! Using insecure default. Set it in .env');
        return 'dev-insecure-secret-change-me';
    })(),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
        httpOnly: true,                                 // no JS access to cookie
        maxAge: 7 * 24 * 60 * 60 * 1000,              // 7 days
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
    },
    name: 'email_dash_sid' // don't use default 'connect.sid'
}));

// ── Routes ────────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV
    });
});

// ── Global Error Handler ──────────────────────────────────────────
app.use((err, req, res, _next) => {
    logger.error('Unhandled error:', { error: err.message, stack: err.stack });
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message
    });
});

// ── Start Server ──────────────────────────────────────────────────
async function start() {
    try {
        await initDatabase();
        logger.info('Database initialized');

        scheduleSyncJobs();
        logger.info('Sync scheduler started');

        app.listen(PORT, () => {
            logger.info(`🚀 Server running on http://localhost:${PORT}`);
            logger.info(`📧 Email Dashboard API ready`);
        });
    } catch (err) {
        logger.error('Failed to start server:', err);
        process.exit(1);
    }
}

start();