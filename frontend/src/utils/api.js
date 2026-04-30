/**
 * API Client
 * Centralized axios instance with auth handling
 */
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const api = axios.create({
    baseURL: API_URL,
    withCredentials: true, // Send session cookies
    timeout: 30000
})

// Response interceptor - handle auth errors globally
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            // Redirect to login if session expired
            window.location.href = '/?session_expired=true'
        }
        return Promise.reject(error)
    }
)

// Auth API
export const authApi = {
    getMe: () => api.get('/auth/me').then(r => r.data),
    logout: () => api.post('/auth/logout').then(r => r.data),
    loginUrl: `${API_URL}/auth/google`
}

// Analytics API
export const analyticsApi = {
    getOverview: () => api.get('/api/analytics/overview').then(r => r.data),
    getVolume: (period = 'daily', range = 30) =>
        api.get('/api/analytics/volume', { params: { period, range } }).then(r => r.data),
    getSenders: (limit = 15) =>
        api.get('/api/analytics/senders', { params: { limit } }).then(r => r.data),
    getLabels: () => api.get('/api/analytics/labels').then(r => r.data),
    getHourly: () => api.get('/api/analytics/hourly').then(r => r.data)
}

// Email API
export const emailApi = {
    getVolume: async () => {
        const res = await fetch('/api/analytics/volume', {
            credentials: 'include'
        });
        return res.json();
    },

    getOverview: async () => {
        const res = await fetch('/api/analytics/overview', {
            credentials: 'include'
        });
        return res.json();
    }
};

export default api