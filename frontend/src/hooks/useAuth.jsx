/**
 * Auth Context
 * Provides authentication state throughout the app
 */
import { createContext, useContext, useState, useEffect } from 'react'
import { authApi } from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Check if user is already authenticated on mount
        authApi.getMe()
            .then(u => setUser(u))
            .catch(() => setUser(null))
            .finally(() => setLoading(false))
    }, [])

    const logout = async () => {
        await authApi.logout()
        setUser(null)
        window.location.href = '/'
    }

    return (
        <AuthContext.Provider value={{ user, loading, logout, setUser }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
    return ctx
}