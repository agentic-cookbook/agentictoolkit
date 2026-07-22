/** HTTP method → color, and response status → color. One authoritative source so
 *  the method badge (text+border) and the endpoint-rail dot (bg) never disagree
 *  and a re-theme touches one place. */

const METHOD_BADGE: Record<string, string> = {
  GET: 'text-apt-green border-apt-green/40',
  POST: 'text-apt-blue border-apt-blue/40',
  PUT: 'text-apt-orange border-apt-orange/40',
  PATCH: 'text-apt-orange border-apt-orange/40',
  DELETE: 'text-apt-red border-apt-red/40',
}

const METHOD_DOT: Record<string, string> = {
  GET: 'bg-apt-green',
  POST: 'bg-apt-blue',
  PUT: 'bg-apt-orange',
  PATCH: 'bg-apt-orange',
  DELETE: 'bg-apt-red',
}

export function methodBadgeClass(method: string): string {
  return METHOD_BADGE[method] ?? 'text-apt-text-muted border-apt-border'
}

/** The method's text-color class ALONE — the leading `text-apt-*` token of {@link methodBadgeClass},
 *  no border. For anything that wants the method tint without the badge chrome (a rail glyph, an
 *  inline label): it reads from the same METHOD_BADGE palette, so it can never drift from the badge
 *  and a re-theme still touches only the map above. */
export function methodTextClass(method: string): string {
  return methodBadgeClass(method).split(' ')[0]!
}

export function methodDotClass(method: string): string {
  return METHOD_DOT[method] ?? 'bg-apt-text-dim'
}

export function statusTone(status: string): string {
  const code = Number(status)
  if (code >= 200 && code < 300) return 'text-apt-green'
  if (code >= 400 && code < 500) return 'text-apt-orange'
  if (code >= 500) return 'text-apt-red'
  return 'text-apt-text-muted'
}
