const { google } = require('googleapis');
const { getAuthenticatedClient, createOAuth2Client } = require('./gmailAuth');
const db = require('./database');

const syncStatus = {}; // in-memory per user

async function syncEmails(userId, sessionTokens = null) {
    syncStatus[userId] = { status: 'running' };
    console.log(`[Sync] Starting for user: ${userId}`);

    try {
        let auth;

        try {
            auth = await getAuthenticatedClient(userId);
        } catch (e) {
            // Fallback: use session tokens directly if DB lookup fails
            if (sessionTokens) {
                console.log('[Sync] DB auth failed, using session tokens');
                auth = createOAuth2Client();
                auth.setCredentials(sessionTokens);
            } else {
                throw e;
            }
        }

        const gmail = google.gmail({ version: 'v1', auth });
        console.log('[Sync] Gmail client ready, fetching messages...');

        const list = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 20
        });

        const messages = list.data.messages || [];
        console.log(`[Sync] Found ${messages.length} messages`);

        for (const msg of messages) {
            const full = await gmail.users.messages.get({
                userId: 'me',
                id: msg.id
            });

            const headers = full.data.payload.headers;
            const getHeader = (name) =>
                headers.find(h => h.name === name)?.value || '';

            db.saveEmail({
                userId,
                gmailId: msg.id,
                threadId: full.data.threadId,
                subject: getHeader('Subject'),
                from: getHeader('From'),
                to: getHeader('To'),
                date: new Date(getHeader('Date')).toISOString(),
                snippet: full.data.snippet,
                labelIds: full.data.labelIds?.join(',') || ''
            });
        }

        syncStatus[userId] = { status: 'idle', lastSync: new Date().toISOString(), count: messages.length };
        console.log(`[Sync] Done. Saved ${messages.length} emails.`);

    } catch (err) {
        console.error('[Sync] Failed:', err.message);
        console.error(err.stack);
        syncStatus[userId] = { status: 'error', error: err.message };
    }
}

function getSyncStatus(userId) {
    return syncStatus[userId] || { status: 'idle' };
}

module.exports = {
    syncEmails,
    getSyncStatus
};