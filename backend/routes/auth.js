const express = require('express');
const router = express.Router();
const {
    getAuthUrl,
    exchangeCodeForTokens,
    getUserInfo,
    createOAuth2Client
} = require('../services/gmailAuth');

// Step 1: Redirect to Google
router.get('/google', (req, res) => {
    const url = getAuthUrl();
    res.redirect(url);
});

// Step 2: Callback
router.get('/google/callback', async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.send('No code received');
    }

    try {
        const tokens = await exchangeCodeForTokens(code);

        const client = createOAuth2Client();
        client.setCredentials(tokens);

        const userInfo = await getUserInfo(client);

        // Store in session ONLY (no DB)
        req.session.tokens = tokens;
        req.session.user = userInfo;
        req.session.userId = userInfo.id || userInfo.email;

        res.redirect('http://localhost:3000'); // frontend
    } catch (err) {
        console.error(err);
        res.send('Auth failed');
    }
});

// Get current user
router.get('/me', (req, res) => {
    if (!req.session.user) {
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