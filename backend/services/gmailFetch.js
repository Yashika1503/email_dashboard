/**
 * Gmail Fetch Service
 * Fetches email metadata from Gmail API and parses it
 * Does NOT store email bodies - only metadata
 */
const { google } = require('googleapis');
const { getAuthenticatedClient } = require('./gmailAuth');
const {
    bulkInsertEmails, upsertSyncState, getSyncState, markLastSync, getEmailCount
} = require('./database');
const logger = require('../utils/logger');

const MAX_RESULTS = parseInt(process.env.MAX_EMAILS_PER_SYNC || '500');

/**
 * Parse Gmail message headers into structured data
 */
function parseMessageHeaders(message) {
    const headers = message.payload?.headers || [];
    const getHeader = (name) =>
        headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

    const fromHeader = getHeader('From');
    // Parse "Name <email>" or just "email"
    const fromMatch = fromHeader.match(/^(.*?)\s*<(.+?)>$/) ||
        fromHeader.match(/^([^<]+)$/);

    let senderName = '';
    let senderEmail = '';
    if (fromMatch) {
        if (fromMatch[2]) {
            senderName = fromMatch[1].replace(/['"]/g, '').trim();
            senderEmail = fromMatch[2].trim();
        } else {
            senderEmail = fromMatch[1].trim();
            senderName = senderEmail.split('@')[0];
        }
    }

    const toHeader = getHeader('To');
    const recipientMatch = toHeader.match(/<(.+?)>/) || [null, toHeader];
    const recipientEmail = recipientMatch[1]?.trim() || '';

    const dateStr = getHeader('Date');
    let date = null;
    if (dateStr) {
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
            date = parsed.toISOString();
        }
    }

    // Fall back to internalDate from Gmail
    if (!date && message.internalDate) {
        date = new Date(parseInt(message.internalDate)).toISOString();
    }

    return {
        gmail_id: message.id,
        thread_id: message.threadId,
        subject: getHeader('Subject') || '(no subject)',
        sender_email: senderEmail.toLowerCase(),
        sender_name: senderName,
        recipient_email: recipientEmail.toLowerCase(),
        date,
        labels: JSON.stringify(message.labelIds || []),
        is_read: !(message.labelIds || []).includes('UNREAD') ? 1 : 0,
        is_sent: (message.labelIds || []).includes('SENT') ? 1 : 0,
        snippet: message.snippet?.substring(0, 200) || '',
        size_estimate: message.sizeEstimate || 0
    };
}

/**
 * Fetch a batch of message IDs from Gmail
 */
async function fetchMessageIds(gmail, pageToken = null, maxResults = 100) {
    const params = {
        userId: 'me',
        maxResults: Math.min(maxResults, 500),
        // Fetch all mail (inbox + sent + everything)
        includeSpamTrash: false
    };
    if (pageToken) params.pageToken = pageToken;

    const { data } = await gmail.users.messages.list(params);
    return {
        messages: data.messages || [],
        nextPageToken: data.nextPageToken || null
    };
}

/**
 * Fetch full metadata for a batch of message IDs
 * Uses batch requests for efficiency
 */
async function fetchMessageDetails(gmail, messageIds) {
    const details = [];

    // Process in chunks of 10 to avoid rate limits
    const CHUNK_SIZE = 10;
    for (let i = 0; i < messageIds.length; i += CHUNK_SIZE) {
        const chunk = messageIds.slice(i, i + CHUNK_SIZE);
        const promises = chunk.map(({ id }) =>
            gmail.users.messages.get({
                userId: 'me',
                id,
                format: 'metadata',
                // Only fetch headers we need (faster, less data)
                metadataHeaders: ['From', 'To', 'Subject', 'Date']
            }).then(r => r.data).catch(err => {
                logger.warn(`Failed to fetch message ${id}: ${err.message}`);
                return null;
            })
        );

        const results = await Promise.all(promises);
        details.push(...results.filter(Boolean));

        // Small delay to respect rate limits (250ms between chunks)
        if (i + CHUNK_SIZE < messageIds.length) {
            await new Promise(r => setTimeout(r, 250));
        }
    }

    return details;
}

/**
 * Full sync: fetch all emails (up to MAX_RESULTS) and cache metadata
 */
async function syncEmails(userId, onProgress = null) {
    logger.info(`Starting email sync for user ${userId}`);
    upsertSyncState(userId, { status: 'running' });

    try {
        const auth = await getAuthenticatedClient(userId);
        const gmail = google.gmail({ version: 'v1', auth });

        let allMessages = [];
        let nextPageToken = null;
        let fetchedCount = 0;

        // Paginate through emails
        do {
            const { messages, nextPageToken: token } = await fetchMessageIds(
                gmail, nextPageToken, 100
            );
            allMessages.push(...messages);
            nextPageToken = token;
            fetchedCount += messages.length;

            if (onProgress) onProgress({ fetched: fetchedCount, total: MAX_RESULTS, stage: 'listing' });

            // Respect our configured limit
            if (allMessages.length >= MAX_RESULTS) {
                allMessages = allMessages.slice(0, MAX_RESULTS);
                break;
            }
        } while (nextPageToken);

        logger.info(`Found ${allMessages.length} message IDs, fetching details...`);

        // Fetch details in batches
        const details = await fetchMessageDetails(gmail, allMessages);
        const parsed = details.map(parseMessageHeaders);

        // Store in database
        const insertedCount = bulkInsertEmails(userId, parsed);
        logger.info(`Inserted ${insertedCount} new emails for user ${userId}`);

        // Update sync state
        upsertSyncState(userId, { status: 'idle', error: null });
        markLastSync(userId);

        return {
            success: true,
            fetched: allMessages.length,
            inserted: insertedCount,
            total: getEmailCount(userId)
        };
    } catch (err) {
        logger.error(`Sync failed for user ${userId}:`, err);
        upsertSyncState(userId, { status: 'error', error: err.message });
        throw err;
    }
}

/**
 * Get sync status for a user
 */
function getSyncStatus(userId) {
    const { getSyncState, getUserById } = require('./database');
    const state = getSyncState(userId);
    const user = getUserById(userId);
    return {
        status: state?.sync_status || 'never_synced',
        lastSync: user?.last_sync,
        errorMessage: state?.error_message,
        emailCount: getEmailCount(userId)
    };
}

module.exports = { syncEmails, getSyncStatus };