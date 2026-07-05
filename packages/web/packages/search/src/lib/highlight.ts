/**
 * Query-term highlighting — the pure, render-free core (c13). A result row turns
 * these segments into React nodes (wrapping `match` segments in `<mark>`), so the
 * highlighting never touches `dangerouslySetInnerHTML`: matches are located here and
 * the text is rendered as plain React children, which React escapes for us.
 */

/** One run of source text plus whether it matched a query term. */
export interface HighlightSegment {
  text: string
  match: boolean
}

/** Escape a user term so it is treated literally inside a RegExp. */
function escapeRegExp(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Split `text` into alternating non-match / match segments against the whitespace-
 * separated terms in `query` (case-insensitive). An empty query (or empty text)
 * yields a single non-match segment, so the caller renders the text verbatim with
 * no marks. Pure + exported for testing.
 */
export function splitHighlightSegments(text: string, query: string): HighlightSegment[] {
  if (!text) return []
  const terms = query.trim().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return [{ text, match: false }]

  const re = new RegExp(`(${terms.map(escapeRegExp).join('|')})`, 'giu')
  const segments: HighlightSegment[] = []
  let last = 0

  for (const m of text.matchAll(re)) {
    const start = m.index
    const end = start + m[0].length
    if (start > last) segments.push({ text: text.slice(last, start), match: false })
    segments.push({ text: m[0], match: true })
    last = end
  }
  if (last < text.length) segments.push({ text: text.slice(last), match: false })

  return segments
}
