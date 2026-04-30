const { google } = require('googleapis');
const { getAuthenticatedClient } = require('./gmailAuth');
const db = require('./database');

const syncStatus = {}; // in-memory per user

async function syncEmails(userId) {
    syncStatus[userId] = { status: 'running' };

    try {
        const auth = await getAuthenticatedClient(userId);
        const gmail = google.gmail({ version: 'v1', auth });

        // Fetch message list
        const list = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 20
        });

        const messages = list.data.messages || [];

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

        syncStatus[userId] = { status: 'idle', count: messages.length };

    } catch (err) {
        console.error('Sync failed:', err);
        syncStatus[userId] = { status: 'error' };
    }
}

function getSyncStatus(userId) {
    return syncStatus[userId] || { status: 'idle' };
}

module.exports = {
    syncEmails,
    getSyncStatus
};