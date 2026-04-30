const express = require('express');
const router = express.Router();
const {
    getAuthUrl,
    exchangeCodeForTokens,
    getUserInfo,
    createOAuth2Client,
    storeTokens  // ← ADD THIS IMPORT
} = require('../services/gmailAuth');

// Step 1: Redirect to Google
router.get('/google', (req, res) => {
    const url = getAuthUrl();
    res.redirect(url);
});

// Step 2: Callback
router.get('/google/callback', async (req, res) => {
    const { code, error } = req.query;  // ← must be FIRST

    if (error) {
        return res.redirect(`${process.env.FRONTEND_URL}?error=${error}`);
    }

    if (!code) {
        return res.redirect(`${process.env.FRONTEND_URL}?error=no_code`);
    }

    if (req.session.userId) {
        return res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
    }

    try {
        const tokens = await exchangeCodeForTokens(code);
        const client = createOAuth2Client();
        client.setCredentials(tokens);
        const userInfo = await getUserInfo(client);
        const userId = userInfo.id || userInfo.email;

        storeTokens(userId, tokens);

        req.session.userId = userId;
        req.session.tokens = tokens;
        req.session.user = userInfo;

        req.session.save((err) => {
            if (err) {
                console.error('Session save error:', err);
                return res.send('Session error');
            }
            res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
        });

    } catch (err) {
        console.error('Auth callback error:', err);
        res.send('Auth failed: ' + err.message);
    }
});

// Get current user
router.get('/me', (req, res) => {
    if (!req.session || !req.session.userId) {
        return res.status(401).json({ error: 'Not logged in' });
    }
    res.json(req.session.user);
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ message: 'Logged out' });
    });
});

module.exports = router;