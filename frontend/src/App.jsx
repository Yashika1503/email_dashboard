import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import EmailsPage from './pages/EmailsPage'
import Layout from './components/Layout'

function ProtectedRoute({ children }) {
    const { user, loading } = useAuth()

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen" style={{ background: 'var(--bg)' }}>
                <div style={{
                    width: 40, height: 40, border: '3px solid var(--border)',
                    borderTopColor: 'var(--ink-primary)', borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                }} />
            </div>
        )
    }

    if (!user) {
        return <Navigate to="/" replace />
    }

    return children
}

function AppRoutes() {
    const { user } = useAuth()

    return (
        <Routes>
            <Route
                path="/"
                element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />}
            />
            <Route
                path="/dashboard"
                element={
                    <ProtectedRoute>
                        <Layout>
                            <DashboardPage />
                        </Layout>
                    </ProtectedRoute>
                }
            />
            <Route
                path="/emails"
                element={
                    <ProtectedRoute>
                        <Layout>
                            <EmailsPage />
                        </Layout>
                    </ProtectedRoute>
                }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    )
}

export default function App() {
    return (
        <AuthProvider>
            <AppRoutes />
        </AuthProvider>
    )
}