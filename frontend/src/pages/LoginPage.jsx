import { useSearchParams } from 'react-router-dom'
import { Mail, BarChart3, Shield, Zap } from 'lucide-react'
import { authApi } from '../utils/api'

const features = [
    { icon: BarChart3, text: 'Volume trends & patterns' },
    { icon: Mail, text: 'Top senders analysis' },
    { icon: Zap, text: 'Read rate & response insights' },
    { icon: Shield, text: 'Read-only, secure OAuth2' }
]

export default function LoginPage() {
    const [params] = useSearchParams()
    const error = params.get('error')
    const expired = params.get('session_expired')

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem'
        }}>
            {/* Background texture */}
            <div style={{
                position: 'fixed', inset: 0, opacity: 0.03,
                backgroundImage: 'radial-gradient(circle at 1px 1px, var(--ink-primary) 1px, transparent 0)',
                backgroundSize: '24px 24px',
                pointerEvents: 'none'
            }} />

            <div style={{ maxWidth: 420, width: '100%', position: 'relative', zIndex: 1 }}>
                {/* Logo */}
                <div className="animate-fade-up" style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
                    <div style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 56, height: 56,
                        background: 'var(--ink-primary)',
                        borderRadius: 16,
                        marginBottom: '1rem',
                        boxShadow: 'var(--shadow-md)'
                    }}>
                        <Mail size={26} color="white" />
                    </div>
                    <h1 style={{
                        fontFamily: 'DM Serif Display, serif',
                        fontSize: '2.2rem',
                        color: 'var(--ink-primary)',
                        marginBottom: '0.4rem'
                    }}>
                        Mailens
                    </h1>
                    <p style={{ color: 'var(--ink-muted)', fontSize: '0.95rem' }}>
                        Your personal email analytics dashboard
                    </p>
                </div>

                {/* Error messages */}
                {(error || expired) && (
                    <div className="animate-fade-up" style={{
                        background: 'var(--rose-light)',
                        border: '1px solid #fecdd3',
                        borderRadius: 10,
                        padding: '0.875rem 1rem',
                        marginBottom: '1.25rem',
                        color: '#be123c',
                        fontSize: '0.875rem'
                    }}>
                        {expired ? 'Your session expired. Please sign in again.' :
                            error === 'access_denied' ? 'You declined access. Permission is required to analyze your emails.' :
                                error === 'config_error' ? 'Server configuration error. Check your .env setup.' :
                                    'Authentication failed. Please try again.'}
                    </div>
                )}

                {/* Login card */}
                <div className="animate-fade-up-delay card-elevated" style={{ marginBottom: '1.5rem' }}>
                    <h2 style={{
                        fontFamily: 'DM Serif Display, serif',
                        fontSize: '1.4rem',
                        marginBottom: '0.5rem'
                    }}>
                        Sign in to get started
                    </h2>
                    <p style={{
                        color: 'var(--ink-muted)',
                        fontSize: '0.875rem',
                        marginBottom: '1.5rem',
                        lineHeight: 1.6
                    }}>
                        Connect your Gmail account using secure OAuth2. We only request
                        read-only access and never store email content.
                    </p>

                    {/* Features list */}
                    <div style={{ marginBottom: '1.75rem' }}>
                        {features.map(({ icon: Icon, text }) => (
                            <div key={text} style={{
                                display: 'flex', alignItems: 'center', gap: '0.625rem',
                                padding: '0.4rem 0',
                                color: 'var(--ink-secondary)',
                                fontSize: '0.875rem'
                            }}>
                                <div style={{
                                    width: 28, height: 28,
                                    background: 'var(--bg)',
                                    border: '1px solid var(--border-light)',
                                    borderRadius: 7,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    <Icon size={14} color="var(--ink-primary)" />
                                </div>
                                {text}
                            </div>
                        ))}
                    </div>

                    {/* Google Sign-in Button */}
                    <a
                        href={authApi.loginUrl}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.75rem',
                            width: '100%',
                            padding: '0.875rem',
                            background: 'white',
                            border: '1.5px solid var(--border)',
                            borderRadius: 10,
                            color: 'var(--ink-primary)',
                            fontFamily: 'DM Sans, sans-serif',
                            fontWeight: 500,
                            fontSize: '0.95rem',
                            textDecoration: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            boxShadow: 'var(--shadow-sm)'
                        }}
                        onMouseEnter={e => {
                            e.currentTarget.style.borderColor = 'var(--ink-muted)'
                            e.currentTarget.style.boxShadow = 'var(--shadow-md)'
                            e.currentTarget.style.transform = 'translateY(-1px)'
                        }}
                        onMouseLeave={e => {
                            e.currentTarget.style.borderColor = 'var(--border)'
                            e.currentTarget.style.boxShadow = 'var(--shadow-sm)'
                            e.currentTarget.style.transform = 'translateY(0)'
                        }}
                    >
                        {/* Google logo SVG */}
                        <svg width="18" height="18" viewBox="0 0 18 18">
                            <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z" />
                            <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z" />
                            <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z" />
                            <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.31z" />
                        </svg>
                        Continue with Google
                    </a>
                </div>

                {/* Privacy note */}
                <p className="animate-fade-up-delay-2" style={{
                    textAlign: 'center',
                    fontSize: '0.78rem',
                    color: 'var(--ink-muted)',
                    lineHeight: 1.6
                }}>
                    <Shield size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                    OAuth2 read-only access · Tokens encrypted at rest · No email content stored
                </p>
            </div>
        </div>
    )
}