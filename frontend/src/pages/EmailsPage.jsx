import { useState, useEffect, useCallback } from 'react'
import { Search, Filter, Mail, ChevronLeft, ChevronRight, RefreshCw, X } from 'lucide-react'
import { authApi, emailApi } from "../utils/api";
import { format } from 'date-fns'

function EmailRow({ email }) {
    const date = email.date ? new Date(email.date) : null
    const labels = (() => {
        try { return JSON.parse(email.labels || '[]') } catch { return [] }
    })()

    const isImportant = labels.includes('IMPORTANT') || labels.includes('STARRED')
    const category = labels.find(l => l.startsWith('CATEGORY_'))?.replace('CATEGORY_', '') || null

    const CATEGORY_COLORS = {
        PERSONAL: '#84cc16',
        SOCIAL: '#14b8a6',
        PROMOTIONS: '#f59e0b',
        UPDATES: '#8b5cf6',
        FORUMS: '#06b6d4'
    }

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            padding: '0.875rem 1rem',
            borderBottom: '1px solid var(--border-light)',
            background: email.is_read ? 'transparent' : 'rgba(245, 158, 11, 0.03)',
            transition: 'background 0.15s',
            gap: '1rem',
            alignItems: 'center'
        }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
            onMouseLeave={e => e.currentTarget.style.background = email.is_read ? 'transparent' : 'rgba(245, 158, 11, 0.03)'}
        >
            <div style={{ minWidth: 0 }}>
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    marginBottom: '0.2rem'
                }}>
                    {!email.is_read && (
                        <div style={{
                            width: 7, height: 7, borderRadius: '50%',
                            background: 'var(--accent)', flexShrink: 0
                        }} />
                    )}
                    <span style={{
                        fontSize: '0.875rem',
                        fontWeight: email.is_read ? 400 : 600,
                        color: 'var(--ink-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                        {email.sender_name || email.sender_email}
                    </span>
                    {isImportant && (
                        <span style={{ color: '#f59e0b', fontSize: '0.75rem', flexShrink: 0 }}>★</span>
                    )}
                    {category && (
                        <span className="badge" style={{
                            background: `${CATEGORY_COLORS[category]}20`,
                            color: CATEGORY_COLORS[category],
                            flexShrink: 0
                        }}>
                            {category.charAt(0) + category.slice(1).toLowerCase()}
                        </span>
                    )}
                </div>
                <div style={{
                    fontSize: '0.8rem', color: 'var(--ink-secondary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    marginBottom: '0.15rem', fontWeight: email.is_read ? 400 : 500
                }}>
                    {email.subject || '(no subject)'}
                </div>
                {email.snippet && (
                    <div style={{
                        fontSize: '0.75rem', color: 'var(--ink-muted)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                        {email.snippet}
                    </div>
                )}
            </div>
            <div style={{
                fontSize: '0.75rem', color: 'var(--ink-muted)',
                flexShrink: 0, textAlign: 'right'
            }}>
                {date ? format(date, 'MMM d') : ''}
            </div>
        </div>
    )
}

export default function EmailsPage() {
    const [emails, setEmails] = useState([])
    const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 1 })
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [sender, setSender] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [page, setPage] = useState(1)
    const [showFilters, setShowFilters] = useState(false)

    const fetchEmails = useCallback(async () => {
        setLoading(true)
        try {
            const data = await emailApi.getEmails({ page, limit: 50, search, sender, startDate, endDate })
            setEmails(data.emails)
            setPagination(data.pagination)
        } catch (err) {
            console.error('Failed to fetch emails:', err)
        } finally {
            setLoading(false)
        }
    }, [page, search, sender, startDate, endDate])

    useEffect(() => {
        const timer = setTimeout(fetchEmails, 300)
        return () => clearTimeout(timer)
    }, [fetchEmails])

    const clearFilters = () => {
        setSearch('')
        setSender('')
        setStartDate('')
        setEndDate('')
        setPage(1)
    }

    const hasFilters = search || sender || startDate || endDate

    return (
        <div>
            {/* Header */}
            <div className="animate-fade-up" style={{ marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Emails</h1>
                <p style={{ color: 'var(--ink-muted)', fontSize: '0.9rem' }}>
                    {pagination.total.toLocaleString()} emails in your cache
                </p>
            </div>

            {/* Search + Filter Bar */}
            <div className="animate-fade-up card" style={{ marginBottom: '1.25rem', padding: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    {/* Search input */}
                    <div style={{
                        flex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem',
                        background: 'var(--bg)', border: '1.5px solid var(--border-light)',
                        borderRadius: 8, padding: '0.5rem 0.75rem'
                    }}>
                        <Search size={15} color="var(--ink-muted)" />
                        <input
                            type="text"
                            placeholder="Search subject or snippet..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1) }}
                            style={{
                                flex: 1, border: 'none', background: 'transparent',
                                fontFamily: 'DM Sans, sans-serif', fontSize: '0.875rem',
                                color: 'var(--ink-primary)', outline: 'none'
                            }}
                        />
                        {search && (
                            <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
                                <X size={13} color="var(--ink-muted)" />
                            </button>
                        )}
                    </div>

                    {/* Toggle filters */}
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="btn-secondary"
                        style={{ flexShrink: 0 }}
                    >
                        <Filter size={14} />
                        Filters
                        {hasFilters && (
                            <span style={{
                                background: 'var(--accent)', color: 'white',
                                borderRadius: '50%', width: 16, height: 16,
                                fontSize: '0.65rem', fontWeight: 700,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>!</span>
                        )}
                    </button>

                    {hasFilters && (
                        <button onClick={clearFilters} style={{
                            border: 'none', background: 'none', cursor: 'pointer',
                            color: 'var(--ink-muted)', fontSize: '0.8rem',
                            display: 'flex', alignItems: 'center', gap: '0.25rem'
                        }}>
                            <X size={13} /> Clear
                        </button>
                    )}
                </div>

                {/* Expanded filters */}
                {showFilters && (
                    <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                        gap: '0.75rem', marginTop: '0.875rem',
                        paddingTop: '0.875rem',
                        borderTop: '1px solid var(--border-light)'
                    }}>
                        <div>
                            <label style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', display: 'block', marginBottom: '0.3rem' }}>
                                From sender
                            </label>
                            <input
                                type="text"
                                placeholder="name or email..."
                                value={sender}
                                onChange={e => { setSender(e.target.value); setPage(1) }}
                                style={{
                                    width: '100%', padding: '0.5rem 0.625rem',
                                    border: '1.5px solid var(--border-light)', borderRadius: 7,
                                    fontFamily: 'DM Sans, sans-serif', fontSize: '0.8rem',
                                    color: 'var(--ink-primary)', outline: 'none', background: 'var(--bg)'
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', display: 'block', marginBottom: '0.3rem' }}>
                                Start date
                            </label>
                            <input
                                type="date" value={startDate}
                                onChange={e => { setStartDate(e.target.value); setPage(1) }}
                                style={{
                                    width: '100%', padding: '0.5rem 0.625rem',
                                    border: '1.5px solid var(--border-light)', borderRadius: 7,
                                    fontFamily: 'DM Sans, sans-serif', fontSize: '0.8rem',
                                    color: 'var(--ink-primary)', outline: 'none', background: 'var(--bg)'
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', display: 'block', marginBottom: '0.3rem' }}>
                                End date
                            </label>
                            <input
                                type="date" value={endDate}
                                onChange={e => { setEndDate(e.target.value); setPage(1) }}
                                style={{
                                    width: '100%', padding: '0.5rem 0.625rem',
                                    border: '1.5px solid var(--border-light)', borderRadius: 7,
                                    fontFamily: 'DM Sans, sans-serif', fontSize: '0.8rem',
                                    color: 'var(--ink-primary)', outline: 'none', background: 'var(--bg)'
                                }}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Email list */}
            <div className="card animate-fade-up-delay" style={{ padding: 0, overflow: 'hidden' }}>
                {/* List header */}
                <div style={{
                    display: 'grid', gridTemplateColumns: '1fr auto',
                    padding: '0.625rem 1rem',
                    background: 'var(--bg)', borderBottom: '1px solid var(--border-light)',
                    gap: '1rem'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Mail size={13} color="var(--ink-muted)" />
                        <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', fontWeight: 500 }}>
                            {loading ? 'Loading...' : `Showing ${emails.length} of ${pagination.total.toLocaleString()}`}
                        </span>
                    </div>
                    {loading && <RefreshCw size={13} color="var(--ink-muted)" style={{ animation: 'spin 1s linear infinite' }} />}
                </div>

                {/* Emails */}
                {loading && emails.length === 0 ? (
                    <div style={{ padding: '1rem' }}>
                        {Array(8).fill(0).map((_, i) => (
                            <div key={i} style={{ marginBottom: '0.75rem' }}>
                                <div className="skeleton" style={{ height: 66, borderRadius: 8 }} />
                            </div>
                        ))}
                    </div>
                ) : emails.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--ink-muted)' }}>
                        <Mail size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                        <p>No emails found{hasFilters ? ' matching your filters' : ''}</p>
                    </div>
                ) : (
                    emails.map(email => <EmailRow key={email.id} email={email} />)
                )}

                {/* Pagination */}
                {pagination.pages > 1 && (
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '0.875rem 1rem',
                        borderTop: '1px solid var(--border-light)',
                        background: 'var(--bg)'
                    }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
                            Page {pagination.page} of {pagination.pages}
                        </span>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1}
                                className="btn-secondary"
                                style={{ padding: '0.4rem 0.75rem', opacity: page <= 1 ? 0.4 : 1 }}
                            >
                                <ChevronLeft size={14} />
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                                disabled={page >= pagination.pages}
                                className="btn-secondary"
                                style={{ padding: '0.4rem 0.75rem', opacity: page >= pagination.pages ? 0.4 : 1 }}
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}