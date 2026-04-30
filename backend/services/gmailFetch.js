// services/gmailFetch.js

module.exports = {
    getSyncStatus: () => ({
        status: 'idle',
        lastSync: new Date().toISOString()
    })
}