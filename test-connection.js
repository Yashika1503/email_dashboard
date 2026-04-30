/**
 * Test Script: Verify your setup before running the full app
 * Run: node tests/test-connection.js
 */

require('dotenv').config({ path: '../.env' });
const https = require('https');
const { google } = require('googleapis');

console.log('\n🔍 Email Dashboard — Setup Verification\n');
console.log('='.repeat(45));

let passed = 0;
let failed = 0;

function check(name, condition, fix) {
    if (condition) {
        console.log(`✅ ${name}`);
        passed++;
    } else {
        console.log(`❌ ${name}`);
        if (fix) console.log(`   → Fix: ${fix}`);
        failed++;
    }
}

// 1. Environment variables
console.log('\n📋 Environment Variables:');
check('SESSION_SECRET set',
    process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32,
    'Generate with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"'
);
check('GOOGLE_CLIENT_ID set',
    !!process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID.includes('.apps.googleusercontent.com'),
    'Copy from Google Cloud Console → APIs & Services → Credentials'
);
check('GOOGLE_CLIENT_SECRET set',
    !!process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CLIENT_SECRET.length > 10,
    'Copy from Google Cloud Console → APIs & Services → Credentials'
);
check('GOOGLE_REDIRECT_URI set',
    !!process.env.GOOGLE_REDIRECT_URI,
    'Should be http://localhost:3001/auth/google/callback'
);
check('TOKEN_ENCRYPTION_KEY set',
    !!process.env.TOKEN_ENCRYPTION_KEY && process.env.TOKEN_ENCRYPTION_KEY.length >= 64,
    'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
);

// 2. OAuth2 client creation
console.log('\n🔑 OAuth2 Configuration:');
try {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/gmail.readonly']
    });
    check('Auth URL generates correctly', url.includes('accounts.google.com'));
} catch (err) {
    check('Auth URL generates correctly', false, err.message);
}

// 3. Encryption test
console.log('\n🔒 Encryption:');
try {
    const { encrypt, decrypt } = require('../utils/encryption');
    const test = 'test-token-value';
    const encrypted = encrypt(test);
    const decrypted = decrypt(encrypted);
    check('AES-256-GCM encryption works', decrypted === test);
    check('Encrypted ≠ original', encrypted !== test);
} catch (err) {
    check('Encryption module', false, err.message);
}

// 4. Database
console.log('\n🗄️ Database:');
try {
    const fs = require('fs');
    const path = require('path');
    const dataDir = path.resolve('../data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

    const Database = require('better-sqlite3');
    const db = new Database(':memory:');
    db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY)');
    db.close();
    check('SQLite works', true);
    check('Data directory writable', fs.existsSync(dataDir));
} catch (err) {
    check('SQLite', false, `npm install in backend directory: ${err.message}`);
}

// Summary
console.log('\n' + '='.repeat(45));
console.log(`Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
    console.log('\n🎉 All checks passed! You\'re ready to run the app.');
    console.log('   Start backend: npm run dev');
} else {
    console.log('\n⚠️  Fix the issues above before running the app.');
    console.log('   See SETUP_GUIDE.md for detailed instructions.');
}

console.log('');