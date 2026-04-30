import { NavLink, useNavigate } from 'react-router-dom'
import { Mail, BarChart3, LogOut, RefreshCw, User } from 'lucide-react'
import { useAuth } from '..//hooks/useAuth'
import { emailApi } from '../utils/api'
import { useState } from 'react'

const navItems = [
    { to: '/dashboard', icon: BarChart3, label: 'Dashboard' },
    { to: '/emails', icon: Mail, label: 'Emails' }
]

export default function Layout({ children }) {
    const { user, logout } = useAuth()
    const [syncing, setSyncing] = useState(false)
    const navigate = useNavigate()

    const handleSync = async () => {
        if (syncing) return
        setSyncing(true)
        try {
            await emailApi.triggerSync()
            setTimeout(() => {
                window.location.reload()
            }, 3000)
        } catch (err) {
            console.error('Sync failed:', err)
        } finally {
            setTimeout(() => setSyncing(false), 3000)
        }
    }

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
            {/* Sidebar */}
            <aside style={{
                width: 220,
                background: 'var(--ink-primary)',
                padding: '1.5rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '2rem',
                flexShrink: 0,
                position: 'sticky',
                top: 0,
                height: '100vh'
            }}>
                {/* Logo */}
                <div style={{ padding: '0.25rem 0.5rem' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.625rem',
                        marginBottom: '0.25rem'
                    }}>
                        <div style={{
                            width: 32, height: 32,
                            background: 'rgba(255,255,255,0.15)',
                            borderRadius: 8,
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Mail size={16} color="white" />
                        </div>
                        <span style={{
                            fontFamily: 'DM Serif Display, serif',
                            fontSize: '1.25rem',
                            color: 'white',
                            letterSpacing: '-0.01em'
                        }}>
                            Mailens
                        </span>
                    </div>
                </div>

                {/* Navigation */}
                <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    {navItems.map(({ to, icon: Icon, label }) => (
                        <NavLink
                            key={to}
                            to={to}
                            style={({ isActive }) => ({
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.625rem',
                                padding: '0.625rem 0.75rem',
                                borderRadius: 8,
                                textDecoration: 'none',
                                fontSize: '0.875rem',
                                fontWeight: isActive ? 600 : 400,
                                color: isActive ? 'white' : 'rgba(255,255,255,0.55)',
                                background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
                                transition: 'all 0.15s ease'
                            })}
                        >
                            {({ isActive }) => (
                                <>
                                    <Icon size={16} opacity={isActive ? 1 : 0.7} />
                                    {label}
                                </>
                            )}
                        </NavLink>
                    ))}
                </nav>

                {/* User section */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                    {/* Sync button */}
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            width: '100%',
                            padding: '0.5rem 0.75rem',
                            borderRadius: 8,
                            background: 'transparent',
                            border: 'none',
                            color: 'rgba(255,255,255,0.6)',
                            fontSize: '0.8rem',
                            cursor: syncing ? 'default' : 'pointer',
                            marginBottom: '0.5rem',
                            transition: 'color 0.15s'
                        }}
                    >
                        <RefreshCw
                            size={14}
                            style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }}
                        />
                        {syncing ? 'Syncing...' : 'Sync emails'}
                    </button>

                    {/* User info */}
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.625rem',
                        padding: '0.5rem 0.75rem',
                        borderRadius: 8,
                        marginBottom: '0.25rem'
                    }}>
                        {user?.picture ? (
                            <img
                                src={user.picture}
                                alt={user.name}
                                style={{ width: 28, height: 28, borderRadius: '50%' }}
                            />
                        ) : (
                            <div style={{
                                width: 28, height: 28, borderRadius: '50%',
                                background: 'rgba(255,255,255,0.2)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                <User size={14} color="white" />
                            </div>
                        )}
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                            <div style={{
                                color: 'white', fontSize: '0.8rem', fontWeight: 500,
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                            }}>
                                {user?.name || 'User'}
                            </div>
                            <div style={{
                                color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                            }}>
                                {user?.email}
                            </div>
                        </div>
                    </div>

                    {/* Logout */}
                    <button
                        onClick={logout}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            width: '100%',
                            padding: '0.5rem 0.75rem',
                            borderRadius: 8,
                            background: 'transparent',
                            border: 'none',
                            color: 'rgba(255,255,255,0.4)',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            transition: 'color 0.15s'
                        }}
                    >
                        <LogOut size={14} />
                        Sign out
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <main style={{ flex: 1, padding: '2rem 2.5rem', overflowY: 'auto', maxWidth: 1200 }}>
                {children}
            </main>
        </div>
    )
}