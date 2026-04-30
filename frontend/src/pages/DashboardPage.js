import { useState, useEffect } from 'react'
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { Mail, Users, Eye, TrendingUp, Clock, AlertCircle, RefreshCw } from 'lucide-react'
import { analyticsApi, emailApi } from '../utils/api'
import { useAuth } from '../hooks/useAuth'
import { format, parseISO } from 'date-fns'

// ── Color palette for charts ──────────────────────────────────────
const CHART_COLORS = ['#27231e', '#f59e0b', '#14b8a6', '#f43f5e', '#8b5cf6', '#06b6d4', '#84cc16']

const LABEL_COLORS = {
    'Inbox': '#27231e',
    'Promotions': '#f59e0b',
    'Social': '#14b8a6',
    'Updates': '#8b5cf6',
    'Forums': '#06b6d4',
    'Sent': '#64748b',
    'Important': '#f43f5e',
    'Starred': '#f59e0b',
    'Personal': '#84cc16',
    'Unread': '#ef4444'
}

// ── Stat Card Component ───────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = 'var(--ink-primary)', delay = 0 }) {
    return (
        <div className="stat-card animate-fade-up" style={{ animationDelay: `${delay}ms` }}>
            <div style={{
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                marginBottom: '0.75rem'
            }}>
                <span style={{ color: 'var(--ink-muted)', fontSize: '0.82rem', fontWeight: 500 }}>
                    {label}
                </span>
                <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: 'var(--bg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <Icon size={15} color={color} />
                </div>
            </div>
            <div style={{
                fontSize: '2rem', fontFamily: 'DM Serif Display, serif',
                color: 'var(--ink-primary)', lineHeight: 1.1, marginBottom: '0.25rem'
            }}>
                {value ?? <div className="skeleton" style={{ height: 32, width: 80 }} />}
            </div>
            {sub && <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>{sub}</div>}
        </div>
    )
}

// ── Custom Tooltip ────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null
    return (
        <div style={{
            background: 'white', border: '1px solid var(--border)',
            borderRadius: 8, padding: '0.625rem 0.875rem',
            boxShadow: 'var(--shadow-md)', fontSize: '0.82rem'
        }}>
            <div style={{ color: 'var(--ink-secondary)', marginBottom: 4 }}>{label}</div>
            {payload.map(p => (
                <div key={p.name} style={{ color: p.color || 'var(--ink-primary)', fontWeight: 600 }}>
                    {p.value?.toLocaleString()} emails
                </div>
            ))}
        </div>
    )
}

// ── Volume Period Selector ────────────────────────────────────────
function PeriodSelector({ value, onChange }) {
    return (
        <div style={{
            display: 'flex', gap: '0.25rem',
            background: 'var(--bg)', borderRadius: 8, padding: '0.2rem'
        }}>
            {[
                { v: 'daily', l: '30d' },
                { v: 'weekly', l: '12w' },
                { v: 'monthly', l: '6mo' }
            ].map(({ v, l }) => (
                <button
                    key={v}
                    onClick={() => onChange(v)}
                    style={{
                        padding: '0.3rem 0.75rem',
                        borderRadius: 6, border: 'none',
                        background: value === v ? 'white' : 'transparent',
                        color: value === v ? 'var(--ink-primary)' : 'var(--ink-muted)',
                        fontFamily: 'DM Sans, sans-serif',
                        fontWeight: value === v ? 600 : 400,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        boxShadow: value === v ? 'var(--shadow-sm)' : 'none',
                        transition: 'all 0.15s ease'
                    }}
                >
                    {l}
                </button>
            ))}
        </div>
    )
}

// ── Main Dashboard Page ───────────────────────────────────────────
export default function DashboardPage() {
    const { user } = useAuth()
    const [overview, setOverview] = useState(null)
    const [volume, setVolume] = useState(null)
    const [senders, setSenders] = useState(null)
    const [labels, setLabels] = useState(null)
    const [hourly, setHourly] = useState(null)
    const [volumePeriod, setVolumePeriod] = useState('daily')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [syncStatus, setSyncStatus] = useState(null)

    useEffect(() => {
        loadAll()
        // Poll sync status
        const interval = setInterval(checkSync, 5000)
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        analyticsApi.getVolume(volumePeriod).then(setVolume).catch(console.error)
    }, [volumePeriod])

    async function loadAll() {
        try {
            setLoading(true)
            const [ov, vol, send, lab, hr, sync] = await Promise.all([
                analyticsApi.getOverview(),
                analyticsApi.getVolume(volumePeriod),
                analyticsApi.getSenders(),
                analyticsApi.getLabels(),
                analyticsApi.getHourly(),
                emailApi.getSyncStatus()
            ])
            setOverview(ov)
            setVolume(vol)
            setSenders(send)
            setLabels(lab)
            setHourly(hr)
            setSyncStatus(sync)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    async function checkSync() {
        try {
            const status = await emailApi.getSyncStatus()
            setSyncStatus(status)
            // Reload analytics when sync completes
            if (status.status === 'idle' && syncStatus?.status === 'running') {
                loadAll()
            }
        } catch { }
    }

    const formatVolumeLabel = (label) => {
        if (!label) return ''
        if (volumePeriod === 'daily') {
            try { return format(parseISO(label), 'MMM d') } catch { return label }
        }
        if (volumePeriod === 'monthly') {
            try { return format(parseISO(label + '-01'), 'MMM yy') } catch { return label }
        }
        return label
    }

    if (error) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
                <AlertCircle size={40} color="var(--rose)" />
                <p style={{ color: 'var(--ink-secondary)' }}>Failed to load analytics: {error}</p>
                <button className="btn-primary" onClick={loadAll}>Try Again</button>
            </div>
        )
    }

    return (
        <div>
            {/* Header */}
            <div className="animate-fade-up" style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                marginBottom: '2rem'
            }}>
                <div>
                    <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>
                        Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},
                        {' '}{user?.name?.split(' ')[0] || 'there'} 👋
                    </h1>
                    <p style={{ color: 'var(--ink-muted)', fontSize: '0.9rem' }}>
                        {overview
                            ? `${overview.totalEmails?.toLocaleString()} emails analyzed`
                            : 'Loading your email analytics...'}
                    </p>
                </div>

                {syncStatus && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.5rem 0.875rem',
                        background: 'white', border: '1px solid var(--border-light)',
                        borderRadius: 8, fontSize: '0.78rem', color: 'var(--ink-muted)'
                    }}>
                        <RefreshCw
                            size={12}
                            style={{ animation: syncStatus.status === 'running' ? 'spin 1s linear infinite' : 'none' }}
                        />
                        {syncStatus.status === 'running' ? 'Syncing...' :
                            syncStatus.lastSync ? `Synced ${format(new Date(syncStatus.lastSync), 'MMM d, h:mm a')}` :
                                'Never synced'}
                    </div>
                )}
            </div>

            {/* Empty state: no emails yet */}
            {!loading && overview?.totalEmails === 0 && (
                <div style={{
                    background: 'white', border: '1px solid var(--border-light)',
                    borderRadius: 12, padding: '3rem', textAlign: 'center',
                    marginBottom: '2rem'
                }}>
                    <Mail size={40} color="var(--ink-muted)" style={{ margin: '0 auto 1rem' }} />
                    <h3 style={{ marginBottom: '0.5rem', fontFamily: 'DM Serif Display, serif' }}>
                        Syncing your emails...
                    </h3>
                    <p style={{ color: 'var(--ink-muted)', fontSize: '0.875rem', maxWidth: 360, margin: '0 auto' }}>
                        Your emails are being fetched in the background. This may take a minute for large inboxes.
                        The page will update automatically.
                    </p>
                </div>
            )}

            {/* Stat Cards */}
            <div style={{
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem', marginBottom: '2rem'
            }}>
                <StatCard
                    icon={Mail} label="Total Emails"
                    value={overview?.totalEmails?.toLocaleString()}
                    sub={`${overview?.last7Days || 0} in last 7 days`}
                    delay={0}
                />
                <StatCard
                    icon={Eye} label="Unread"
                    value={overview?.unreadCount?.toLocaleString()}
                    sub={`${100 - (overview?.readRate || 0)}% unread rate`}
                    color="var(--rose)" delay={50}
                />
                <StatCard
                    icon={TrendingUp} label="Read Rate"
                    value={overview?.readRate != null ? `${overview.readRate}%` : null}
                    sub="of all received emails"
                    color="var(--teal)" delay={100}
                />
                <StatCard
                    icon={Users} label="7-Day Change"
                    value={overview?.volumeChange != null
                        ? `${overview.volumeChange > 0 ? '+' : ''}${overview.volumeChange}%`
                        : null}
                    sub="vs previous 7 days"
                    color="var(--accent)" delay={150}
                />
            </div>

            {/* Volume Chart + Read/Unread */}
            <div style={{
                display: 'grid', gridTemplateColumns: '1fr 320px',
                gap: '1.25rem', marginBottom: '1.25rem'
            }}>
                {/* Volume over time */}
                <div className="card animate-fade-up" style={{ animationDelay: '200ms' }}>
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        marginBottom: '1.5rem'
                    }}>
                        <h2 style={{ fontSize: '1.1rem' }}>Email Volume</h2>
                        <PeriodSelector value={volumePeriod} onChange={setVolumePeriod} />
                    </div>
                    {volume?.data ? (
                        <ResponsiveContainer width="100%" height={220}>
                            <AreaChart data={volume.data}>
                                <defs>
                                    <linearGradient id="volumeGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#27231e" stopOpacity={0.15} />
                                        <stop offset="95%" stopColor="#27231e" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" />
                                <XAxis
                                    dataKey={volumePeriod === 'daily' ? 'day' : volumePeriod === 'weekly' ? 'week' : 'month'}
                                    tickFormatter={formatVolumeLabel}
                                    tick={{ fill: 'var(--ink-muted)', fontSize: 11 }}
                                    axisLine={false} tickLine={false}
                                    interval="preserveStartEnd"
                                />
                                <YAxis tick={{ fill: 'var(--ink-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Area
                                    type="monotone" dataKey="count"
                                    stroke="#27231e" strokeWidth={2}
                                    fill="url(#volumeGrad)"
                                    dot={false} activeDot={{ r: 4, fill: '#27231e' }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="skeleton" style={{ height: 220 }} />
                    )}
                </div>

                {/* Read vs Unread Pie */}
                <div className="card animate-fade-up" style={{ animationDelay: '250ms' }}>
                    <h2 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>Read vs Unread</h2>
                    {overview ? (
                        <>
                            <ResponsiveContainer width="100%" height={160}>
                                <PieChart>
                                    <Pie
                                        data={[
                                            { name: 'Read', value: overview.readCount || 0 },
                                            { name: 'Unread', value: overview.unreadCount || 0 }
                                        ]}
                                        cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                                        dataKey="value" strokeWidth={2} stroke="white"
                                    >
                                        <Cell fill="#27231e" />
                                        <Cell fill="#f59e0b" />
                                    </Pie>
                                    <Tooltip formatter={(v) => v.toLocaleString()} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '0.5rem' }}>
                                {[
                                    { label: 'Read', color: '#27231e', value: overview.readCount },
                                    { label: 'Unread', color: '#f59e0b', value: overview.unreadCount }
                                ].map(({ label, color, value }) => (
                                    <div key={label} style={{ textAlign: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.2rem' }}>
                                            <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
                                            <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>{label}</span>
                                        </div>
                                        <div style={{ fontWeight: 600, fontSize: '1rem' }}>{value?.toLocaleString()}</div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="skeleton" style={{ height: 200 }} />
                    )}
                </div>
            </div>

            {/* Top Senders + Labels */}
            <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr',
                gap: '1.25rem', marginBottom: '1.25rem'
            }}>
                {/* Top Senders */}
                <div className="card animate-fade-up" style={{ animationDelay: '300ms' }}>
                    <h2 style={{ fontSize: '1.1rem', marginBottom: '1.25rem' }}>Top Senders</h2>
                    {senders?.senders ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                            {senders.senders.slice(0, 8).map((sender, i) => {
                                const maxCount = senders.senders[0]?.count || 1
                                const pct = Math.round((sender.count / maxCount) * 100)
                                return (
                                    <div key={sender.sender_email}>
                                        <div style={{
                                            display: 'flex', justifyContent: 'space-between',
                                            alignItems: 'center', marginBottom: '0.3rem'
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 0 }}>
                                                <div style={{
                                                    width: 22, height: 22, borderRadius: '50%',
                                                    background: CHART_COLORS[i % CHART_COLORS.length],
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: '0.65rem', color: 'white', fontWeight: 700, flexShrink: 0
                                                }}>
                                                    {(sender.sender_name || sender.sender_email)[0]?.toUpperCase()}
                                                </div>
                                                <span style={{
                                                    fontSize: '0.82rem', color: 'var(--ink-secondary)',
                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                                }}>
                                                    {sender.sender_name || sender.sender_email}
                                                </span>
                                            </div>
                                            <span style={{
                                                fontSize: '0.78rem', fontWeight: 600,
                                                color: 'var(--ink-primary)', flexShrink: 0, marginLeft: '0.5rem'
                                            }}>
                                                {sender.count}
                                            </span>
                                        </div>
                                        <div style={{
                                            height: 4, background: 'var(--bg)',
                                            borderRadius: 2, overflow: 'hidden'
                                        }}>
                                            <div style={{
                                                height: '100%', width: `${pct}%`,
                                                background: CHART_COLORS[i % CHART_COLORS.length],
                                                borderRadius: 2, transition: 'width 0.6s ease'
                                            }} />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                            {Array(6).fill(0).map((_, i) => (
                                <div key={i} className="skeleton" style={{ height: 36 }} />
                            ))}
                        </div>
                    )}
                </div>

                {/* Label Breakdown */}
                <div className="card animate-fade-up" style={{ animationDelay: '350ms' }}>
                    <h2 style={{ fontSize: '1.1rem', marginBottom: '1.25rem' }}>Categories</h2>
                    {labels?.labels ? (
                        <ResponsiveContainer width="100%" height={260}>
                            <BarChart
                                data={labels.labels.slice(0, 8)}
                                layout="vertical"
                                margin={{ left: 8, right: 16 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" horizontal={false} />
                                <XAxis type="number" tick={{ fill: 'var(--ink-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                                <YAxis
                                    type="category" dataKey="label" width={80}
                                    tick={{ fill: 'var(--ink-secondary)', fontSize: 11 }}
                                    axisLine={false} tickLine={false}
                                />
                                <Tooltip formatter={(v) => [v.toLocaleString(), 'Emails']} />
                                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                    {labels.labels.slice(0, 8).map((entry, i) => (
                                        <Cell
                                            key={entry.label}
                                            fill={LABEL_COLORS[entry.label] || CHART_COLORS[i % CHART_COLORS.length]}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="skeleton" style={{ height: 260 }} />
                    )}
                </div>
            </div>

            {/* Hourly Distribution */}
            <div className="card animate-fade-up" style={{ animationDelay: '400ms', marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>
                    Email Activity by Hour
                    <span style={{ fontSize: '0.78rem', fontWeight: 400, fontFamily: 'DM Sans, sans-serif', color: 'var(--ink-muted)', marginLeft: '0.5rem' }}>
                        (your local time)
                    </span>
                </h2>
                {hourly?.data ? (
                    <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={hourly.data} margin={{ left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                            <XAxis
                                dataKey="hour"
                                tickFormatter={h => h % 6 === 0 ? `${h}:00` : ''}
                                tick={{ fill: 'var(--ink-muted)', fontSize: 10 }}
                                axisLine={false} tickLine={false}
                            />
                            <YAxis tick={{ fill: 'var(--ink-muted)', fontSize: 10 }} axisLine={false} tickLine={false} />
                            <Tooltip
                                formatter={(v) => [v.toLocaleString(), 'Emails']}
                                labelFormatter={(h) => `${h}:00 – ${h + 1}:00`}
                            />
                            <Bar dataKey="count" fill="var(--teal)" radius={[3, 3, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="skeleton" style={{ height: 160 }} />
                )}
            </div>
        </div>
    )
}