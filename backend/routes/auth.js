/**
 * Authentication Routes
 * Handles Google OAuth2 flow:
 *   GET /auth/google         → Redirect to Google
 *   GET /auth/google/callback → Handle callback, store tokens
 *   GET /auth/me             → Get current user info
 *   POST /auth/logout        → Clear session
 */
const express = require('express');
const router = express.Router();
const {
    getAuthUrl, exchangeCodeForTokens, storeTokens, getUserInfo, createOAuth2Client
} = require('../services/gmailAuth');
const { upsertUser } = require('../services/database');
const { syncEmails } = require('../services/gmailFetch');
const { requireAuth } = require('../middleware/auth');
const logger = require('../utils/logger');

// ── Step 1: Redirect user to Google's OAuth consent screen ────────
router.get('/google', (req, res) => {
    try {
        const url = getAuthUrl();
        logger.info('Redirecting to Google OAuth');
        res.redirect(url);
    } catch (err) {
        logger.error('Failed to generate auth URL:', err);
        res.redirect(`${process.env.FRONTEND_URL}?error=config_error`);
    }
});

// ── Step 2: Handle OAuth callback from Google ─────────────────────
router.get('/google/callback', async (req, res) => {
    const { code, error } = req.query;

    // User denied permission
    if (error) {
        logger.warn(`OAuth denied: ${error}`);
        return res.redirect(`${process.env.FRONTEND_URL}?error=access_denied`);
    }

    if (!code) {
        return res.redirect(`${process.env.FRONTEND_URL}?error=no_code`);
    }

    try {
        // Exchange authorization code for access + refresh tokens
        const tokens = await exchangeCodeForTokens(code);
        logger.info('Tokens received from Google');

        // Get user's profile info
        const { google } = require('googleapis');
        const { createOAuth2Client } = require('../services/gmailAuth');
        const client = createOAuth2Client();
        client.setCredentials(tokens);
        const userInfo = await getUserInfo(client);

        // Create or update user in database
        const user = upsertUser({
            googleId: userInfo.id,
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture
        });

        // Store encrypted tokens
        storeTokens(user.id, tokens);

        // Create authenticated session
        req.session.userId = user.id;
        req.session.userEmail = user.email;

        logger.info(`User authenticated: ${user.email}`);

        // Trigger initial sync in background (don't wait)
        syncEmails(user.id).catch(err =>
            logger.error(`Initial sync failed for ${user.email}: ${err.message}`)
        );

        // Redirect to frontend dashboard
        res.redirect(`${process.env.FRONTEND_URL}/dashboard?auth=success`);
    } catch (err) {
        logger.error('OAuth callback error:', err);
        res.redirect(`${process.env.FRONTEND_URL}?error=auth_failed`);
    }
});

// ── Get current user info ─────────────────────────────────────────
router.get('/me', requireAuth, (req, res) => {
    const { getUserById } = require('../services/database');
    const user = getUserById(req.session.userId);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    // Don't expose sensitive fields
    res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        lastSync: user.last_sync,
        lastLogin: user.last_login
    });
});

// ── Logout ────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            logger.error('Session destroy error:', err);
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.clearCookie('email_dash_sid');
        res.json({ message: 'Logged out successfully' });
    });
});

module.exports = router;