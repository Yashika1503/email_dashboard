/**
 * Token Encryption Utility
 * Encrypts OAuth tokens before storing in database
 * Uses AES-256-GCM (authenticated encryption)
 */
const crypto = require('crypto');
const logger = require('./logger');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;   // 128 bits
const TAG_LENGTH = 16;  // 128 bits

/**
 * Get encryption key from environment
 * Key must be 32 bytes (64 hex chars)
 */
function getEncryptionKey() {
    const keyHex = process.env.TOKEN_ENCRYPTION_KEY;
    if (!keyHex || keyHex.length < 64) {
        logger.warn('TOKEN_ENCRYPTION_KEY not set or too short. Tokens stored unencrypted in dev mode.');
        return null;
    }
    return Buffer.from(keyHex.slice(0, 64), 'hex');
}

/**
 * Encrypt a string (e.g., access token, refresh token)
 * Returns: iv:authTag:encrypted (all hex)
 */
function encrypt(text) {
    const key = getEncryptionKey();
    if (!key) return text; // fallback: no encryption in dev without key

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt an encrypted string
 */
function decrypt(encryptedText) {
    const key = getEncryptionKey();
    if (!key) return encryptedText; // fallback: no encryption in dev

    try {
        const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
        if (!ivHex || !authTagHex || !encrypted) {
            throw new Error('Invalid encrypted format');
        }

        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (err) {
        logger.error('Token decryption failed:', err.message);
        throw new Error('Failed to decrypt token - it may be corrupted');
    }
}

module.exports = { encrypt, decrypt };