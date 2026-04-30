/**
 * Email Analytics Dashboard - Backend Server
 * Secure Gmail API integration with OAuth2
 */

require('dotenv').config();

console.log("REDIRECT URI:", process.env.GOOGLE_REDIRECT_URI);

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

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
    console.log(`Created data directory: ${dataDir}`);
}

app.set('trust proxy', 1);

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

app.use(cors({
    origin: "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type"]
}));

// handle preflight explicitly
app.options('*', cors());

app.use(express.json({ limit: '10mb' }));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,       // ← must be false for http://localhost
        httpOnly: true,
        sameSite: 'lax',     // ← 'lax' allows redirect-back from Google
        maxAge: 7 * 24 * 60 * 60 * 1000  // 1 week
    }
}));

// ── Routes ────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/analytics', analyticsRoutes);

app.get('/', (req, res) => {
    res.json({ message: 'Email Dashboard API running' });
});

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
    console.error('Unhandled error:', { error: err.message, stack: err.stack });
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Internal server error'
            : err.message
    });
});

// ── Start Server ──────────────────────────────────────────────────
function start() {
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

start();

