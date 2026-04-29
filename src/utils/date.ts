const TIMEZONE = process.env.EXPENSE_TIMEZONE ?? 'Asia/Kuala_Lumpur'

export function nowUTC(): string {
    return new Date().toISOString()
}

export function getTimezone(): string {
    return TIMEZONE
}

// Returns a SQLite datetime() modifier string, e.g. "+480 minutes" for UTC+8.
// Computed via Intl-based arithmetic so DST-aware timezones work correctly.
export function getUtcOffsetStr(): string {
    const now = new Date()
    const localMs = new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE })).getTime()
    const utcMs   = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' })).getTime()
    const offsetMinutes = Math.round((localMs - utcMs) / 60000)
    return offsetMinutes >= 0 ? `+${offsetMinutes} minutes` : `${offsetMinutes} minutes`
}

// Accepts any ISO 8601 string (with or without offset) and returns a UTC ISO string.
export function toUTC(dateStr: string): string {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) throw new Error(`Invalid date: ${dateStr}`)
    return d.toISOString()
}

// Formats a UTC ISO string to a human-readable local datetime string.
// sv-SE locale reliably produces "YYYY-MM-DD HH:mm:ss" — unambiguous, no AM/PM.
export function toLocalDisplay(utcStr: string): string {
    return new Date(utcStr).toLocaleString('sv-SE', { timeZone: TIMEZONE })
}
