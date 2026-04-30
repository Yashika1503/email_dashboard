/**
 * Sync Scheduler
 * Periodically re-syncs emails for all authenticated users
 */
const cron = require('node-cron');
const { getDb } = require('./database');
const { syncEmails } = require('./gmailFetch');
const logger = require('../utils/logger');

const SYNC_INTERVAL_HOURS = parseInt(process.env.SYNC_INTERVAL_HOURS || '1');

function scheduleSyncJobs() {
    // Run every N hours
    const cronExpression = `0 */${SYNC_INTERVAL_HOURS} * * *`;

    cron.schedule(cronExpression, async () => {
        logger.info('Running scheduled email sync...');

        try {
            const users = getDb().prepare(`
        SELECT u.id FROM users u
        JOIN oauth_tokens t ON t.user_id = u.id
        WHERE t.refresh_token IS NOT NULL
      `).all();

            logger.info(`Syncing ${users.length} users`);

            for (const user of users) {
                try {
                    await syncEmails(user.id);
                } catch (err) {
                    logger.error(`Scheduled sync failed for user ${user.id}: ${err.message}`);
                }
            }
        } catch (err) {
            logger.error('Scheduled sync job error:', err);
        }
    });

    logger.info(`Sync scheduler running every ${SYNC_INTERVAL_HOURS} hour(s)`);
}

module.exports = { scheduleSyncJobs };