/**
 * Gmail OAuth2 Service
 * Handles OAuth2 flow, token management, and Gmail API calls
 * Uses official Google APIs Node.js client
 */
const { google } = require('googleapis');
const { encrypt, decrypt } = require('../utils/encryption');
const { saveTokens, getTokens, updateAccessToken } = require('./database');
const logger = require('../utils/logger');

// Gmail scopes - requesting minimum necessary permissions
const SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',   // Read emails
    'https://www.googleapis.com/auth/userinfo.email',   // Get user email
    'https://www.googleapis.com/auth/userinfo.profile'  // Get user name/picture
];

/**
 * Create a new OAuth2 client instance
 */
const createOAuth2Client = () => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
        throw new Error(
            'Missing OAuth2 configuration. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI in .env'
        );
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Generate the Google OAuth2 authorization URL
 * User is redirected here to grant permissions
 */
function getAuthUrl() {
    console.log("Using redirect URI:", process.env.GOOGLE_REDIRECT_URI);

    const oauth2Client = createOAuth2Client();
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
        include_granted_scopes: true
    });
}

/**
 * Exchange authorization code for tokens
 * Called after user grants permission and is redirected back
 */
async function exchangeCodeForTokens(code) {
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
}

/**
 * Get an authenticated OAuth2 client for a user
 * Automatically refreshes access token if expired
 */
async function getAuthenticatedClient(userId) {
    const tokenRow = getTokens(userId);
    if (!tokenRow) {
        throw new Error('No tokens found. User must re-authenticate.');
    }

    const oauth2Client = createOAuth2Client();

    // Decrypt tokens from database
    const accessToken = decrypt(tokenRow.access_token);
    const refreshToken = tokenRow.refresh_token ? decrypt(tokenRow.refresh_token) : null;

    oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
        expiry_date: tokenRow.token_expiry ? new Date(tokenRow.token_expiry).getTime() : null
    });

    // Handle automatic token refresh
    oauth2Client.on('tokens', (newTokens) => {
        logger.info(`Tokens refreshed for user ${userId}`);
        if (newTokens.access_token) {
            updateAccessToken(
                userId,
                encrypt(newTokens.access_token),
                newTokens.expiry_date ? new Date(newTokens.expiry_date).toISOString() : null
            );
        }
    });

    return oauth2Client;
}

/**
 * Save encrypted tokens to database
 */
function storeTokens(userId, tokens) {
    saveTokens(userId, {
        accessToken: encrypt(tokens.access_token),
        refreshToken: tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
        expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        scope: tokens.scope
    });
}

/**
 * Get user's Google profile info using their tokens
 */
async function getUserInfo(oauth2Client) {
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data } = await oauth2.userinfo.get();
    return data;
}

module.exports = {
    createOAuth2Client,
    getAuthUrl,
    exchangeCodeForTokens,
    getAuthenticatedClient,
    storeTokens,
    getUserInfo,
    SCOPES
};