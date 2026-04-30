const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

async function request(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        },
        ...options
    });

    if (!res.ok) {
        throw new Error(await res.text());
    }

    return res.json();
}

export const authApi = {
    loginUrl: `${API_BASE}/auth/google`,
    me: () => request("/auth/me"),
    logout: () => request("/auth/logout", { method: "POST" })
};

export const emailApi = {
    getEmails: (params = "") => request(`/api/emails${params}`),
    triggerSync: () => request("/api/emails/sync", { method: "POST" }),
    getSyncStatus: () => request("/api/emails/sync/status")
};

export const analyticsApi = {
    getOverview: () => request("/api/analytics/overview"),
    getVolume: () => request("/api/analytics/volume"),
    getSenders: () => request("/api/analytics/senders"),
    getLabels: () => request("/api/analytics/labels"),
    getHourly: () => request("/api/analytics/hourly")
};