/**
 * Authentication Middleware
 * Protects API routes - user must be authenticated via session
 */
const logger = require('../utils/logger');

function requireAuth(req, res, next) {
    if (!req.session?.userId) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Please sign in with your Google account',
            authUrl: '/auth/google'
        });
    }
    next();
}

module.exports = { requireAuth };