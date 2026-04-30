const express = require('express');
const router = express.Router();
const { google } = require('googleapis');

// Middleware
function requireAuth(req, res, next) {
    if (!req.session.tokens) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    next();
}

router.use(requireAuth);

// Get emails directly from Gmail
router.get('/', async (req, res) => {
    try {
        const auth = new google.auth.OAuth2();
        auth.setCredentials(req.session.tokens);

        const gmail = google.gmail({ version: 'v1', auth });

        const response = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 10
        });

        const messages = response.data.messages || [];

        res.json(messages);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch emails' });
    }
});

module.exports = router;