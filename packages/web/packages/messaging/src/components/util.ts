// Small presentation helpers shared across the messaging components. Extracted so
// `cx`, `formatRelativeTime`, and `initialsOf` each have ONE definition instead of a
// verbatim copy in every component file (they were duplicated across dm-list,
// dm-thread, dm-panel, presence-dot and notification-inbox).

/** Tiny class joiner (avoids depending on ui's internal `cn`). */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

const RELATIVE_DIVISIONS: Array<{ amount: number; unit: Intl.RelativeTimeFormatUnit }> = [
  { amount: 60, unit: 'second' },
  { amount: 60, unit: 'minute' },
  { amount: 24, unit: 'hour' },
  { amount: 7, unit: 'day' },
  { amount: 4.34524, unit: 'week' },
  { amount: 12, unit: 'month' },
  { amount: Number.POSITIVE_INFINITY, unit: 'year' },
]

/** ISO timestamp → a short relative label ("3 minutes ago"), via native Intl. */
export function formatRelativeTime(iso: string): string {
  const ms = new Date(iso).getTime()
  if (Number.isNaN(ms)) return ''
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  let duration = (ms - Date.now()) / 1000
  for (const division of RELATIVE_DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return rtf.format(Math.round(duration), division.unit)
    }
    duration /= division.amount
  }
  return ''
}

/** Up to two uppercase initials for an avatar fallback, from an id/handle. */
export function initialsOf(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return '?'
  const [a, b] = trimmed.split(/[\s._-]+/).filter(Boolean)
  const letters = a && b ? a.charAt(0) + b.charAt(0) : trimmed.slice(0, 2)
  return letters.toUpperCase()
}
