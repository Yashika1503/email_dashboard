import { createContext, useContext, useEffect, useState } from 'react'
import { authApi } from '../utils/api'

const AuthContext = createContext()

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    const loadUser = async () => {
        try {
            const me = await authApi.me()
            setUser(me)
        } catch {
            setUser(null)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadUser()
    }, [])

    return (
        <AuthContext.Provider value={{ user, setUser, loading, refresh: loadUser }}>
            {children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)