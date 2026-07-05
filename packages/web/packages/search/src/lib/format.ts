/**
 * Stable, locale-light date label (e.g. "Jun 24, 2026") shared by the markdown result
 * row and preview header (mirrors the research site's papers-api.formatUpdated).
 * An unparseable input yields `''` — callers render nothing rather than "Invalid Date".
 */
export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}
