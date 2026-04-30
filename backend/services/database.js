// services/database.js

const mockEmails = []

module.exports = {
    getReadStats: () => ({
        total: 120,
        unread_count: 30,
        read_count: 90,
        sent_count: 10
    }),

    getTopSenders: () => ([
        { sender_email: "test1@gmail.com", count: 20 },
        { sender_email: "test2@gmail.com", count: 15 }
    ]),

    getVolumeByDay: () => ([
        { day: "2026-04-25", count: 10 },
        { day: "2026-04-26", count: 15 }
    ]),

    getVolumeByWeek: () => ([
        { week: "2026-W17", count: 50 }
    ]),

    getVolumeByMonth: () => ([
        { month: "2026-04", count: 120 }
    ]),

    getLabelBreakdown: () => ([
        { label: "INBOX", count: 80 },
        { label: "CATEGORY_SOCIAL", count: 20 },
        { label: "CATEGORY_PROMOTIONS", count: 20 }
    ]),

    getHourlyDistribution: () => (
        Array.from({ length: 24 }, (_, h) => ({
            hour: h,
            count: Math.floor(Math.random() * 10)
        }))
    )
}