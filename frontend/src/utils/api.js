// utils/api.js
// All API calls go through /api/* — assumes the dev proxy or same-origin in prod.

const BASE = '/api';

async function apiFetch(url, options = {}) {
    const res = await fetch(BASE + url, {
        credentials: 'include', // send session cookie
        headers: { 'Content-Type': 'application/json', ...options.headers },
        ...options
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }

    return res.json();
}

// ─────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────
export const authApi = {
    loginUrl: '/api/auth/google',
    getUser: () => apiFetch('/api/auth/me'),
    logout: () => apiFetch('/api/auth/logout', { method: 'POST' })
};

// ─────────────────────────────────────────────
// EMAILS
// ─────────────────────────────────────────────
export const emailApi = {
    getEmails: ({ page = 1, limit = 50, search = '', sender = '', startDate = '', endDate = '' } = {}) => {
        const params = new URLSearchParams({ page, limit });
        if (search) params.set('search', search);
        if (sender) params.set('sender', sender);
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        return apiFetch(`/emails?${params}`);
    },

    syncEmails: () => apiFetch('/emails/sync', { method: 'POST' }),

    getSyncStatus: () => apiFetch('/emails/sync/status')
};

// ─────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────
export const analyticsApi = {
    getOverview: () => apiFetch('/emails/analytics/overview'),

    getVolume: (period = 'daily') =>
        apiFetch(`/emails/analytics/volume?period=${period}`),

    getSenders: () => apiFetch('/emails/analytics/senders'),

    getLabels: () => apiFetch('/emails/analytics/labels'),

    getHourly: () => apiFetch('/emails/analytics/hourly')
};