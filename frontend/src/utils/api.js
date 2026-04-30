const API_BASE = 'http://localhost:3001'

async function request(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        credentials: 'include',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    })

    if (!res.ok) {
        throw new Error(await res.text())
    }

    return res.json()
}

export const authApi = {
    loginUrl: `${API_BASE}/auth/google`,
    me: () => request('/auth/me'),
    logout: () => request('/auth/logout', { method: 'POST' })
}

export const emailApi = {
    getEmails: () => request('/api/emails'),
    triggerSync: () => request('/api/emails/sync', { method: 'POST' }),
    getSyncStatus: () => request('/api/emails/sync/status'),
    getLabels: () => request('/api/emails/labels'),
    getHourly: () => request('/api/emails/hourly'),
    getOverview: () => request('/api/emails/overview'),

    // analytics (THIS FIXES YOUR CRASHES)
    getVolume: () => request('/api/analytics/volume'),
    getOverview: () => request('/api/analytics/overview'),
    getSenders: () => request('/api/analytics/senders')
}