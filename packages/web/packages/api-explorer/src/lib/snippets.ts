/**
 * Client code snippets for an endpoint — what an external caller would run against
 * the public API. Uses the backend-native path (no `/api`) against the public
 * origin and a `YOUR_TOKEN` placeholder (never the live token) so nothing sensitive
 * ends up on the clipboard.
 */
import { substitutePath } from './buildRequest'
import type { EndpointMeta } from '../types'
import type { RequestValues } from './buildRequest'

/** Default public API origin (prod). Overridable via the panel's `apiOrigin` prop. */
export const PUBLIC_API_ORIGIN = 'https://api.agenticdeveloperhub.com'

export const TOKEN_PLACEHOLDER = 'YOUR_TOKEN'

export type SnippetLang = 'curl' | 'javascript'

export const SNIPPET_LANGS: { id: SnippetLang; label: string; highlight: 'bash' | 'javascript' }[] = [
  { id: 'curl', label: 'cURL', highlight: 'bash' },
  { id: 'javascript', label: 'JavaScript', highlight: 'javascript' },
]

function snippetUrl(meta: EndpointMeta, values: RequestValues, origin: string): string {
  const path = substitutePath(meta.path, values.pathValues)
  const query = new URLSearchParams()
  for (const param of meta.params) {
    if (param.in !== 'query') continue
    const value = values.queryValues[param.name]
    if (value != null && value !== '') query.set(param.name, value)
  }
  const qs = query.toString()
  return `${origin}${path}${qs ? `?${qs}` : ''}`
}

function bodyText(meta: EndpointMeta, values: RequestValues): string | undefined {
  if (meta.requestBody == null) return undefined
  const raw = values.body
  return raw != null && raw.trim() !== '' ? raw.trim() : undefined
}

export function curlSnippet(meta: EndpointMeta, values: RequestValues, origin = PUBLIC_API_ORIGIN): string {
  const url = snippetUrl(meta, values, origin)
  const lines = [`curl -X ${meta.method} "${url}" \\`, `  -H "Authorization: Bearer ${TOKEN_PLACEHOLDER}"`]
  const body = bodyText(meta, values)
  if (body) {
    lines[lines.length - 1] += ' \\'
    lines.push(`  -H "Content-Type: ${meta.requestBody?.contentType ?? 'application/json'}" \\`)
    // Single-quote the JSON body; escape any embedded single quotes for the shell.
    lines.push(`  -d '${body.replace(/'/g, "'\\''")}'`)
  }
  return lines.join('\n')
}

export function javascriptSnippet(meta: EndpointMeta, values: RequestValues, origin = PUBLIC_API_ORIGIN): string {
  const url = snippetUrl(meta, values, origin)
  const body = bodyText(meta, values)
  const headers: string[] = [`    "Authorization": "Bearer ${TOKEN_PLACEHOLDER}"`]
  if (body) headers.push(`    "Content-Type": "${meta.requestBody?.contentType ?? 'application/json'}"`)
  const lines = [
    `const res = await fetch("${url}", {`,
    `  method: "${meta.method}",`,
    `  headers: {`,
    headers.join(',\n'),
    `  },`,
  ]
  if (body) lines.push(`  body: ${JSON.stringify(body)},`)
  lines.push(`});`, `const data = await res.json();`)
  return lines.join('\n')
}

export function snippetFor(lang: SnippetLang, meta: EndpointMeta, values: RequestValues, origin = PUBLIC_API_ORIGIN): string {
  return lang === 'curl' ? curlSnippet(meta, values, origin) : javascriptSnippet(meta, values, origin)
}
