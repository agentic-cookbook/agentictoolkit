// The ONE client for the theme persistence API. Reads hit the unauthenticated
// /public/themes surface; writes hit the env-gated /themes routes. Both go through
// the same same-origin `/api` BFF proxy that every adh site already configures
// (rewrites `/api/:path*` → backend `/:path*`), so this works unchanged on every
// site with no per-site duplication. Cookies (the session JWT) ride along on
// same-origin requests, so writes are authorized without extra wiring.

import type { ThemeDelta } from '@agenticdevelopertoolkit/themes/tokens'

/** A theme as stored/returned by the backend — `data` is the delta from `basedOn`. */
export interface StoredTheme {
  key: string
  label: string
  basedOn: string | null
  data: ThemeDelta
  createdAt: string
  updatedAt: string
}

export interface ThemeWrite {
  label: string
  basedOn?: string | null
  data: ThemeDelta
}

const API = '/api'

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`themes API ${res.status}`)
  return (await res.json()) as T
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})

/** Every live theme (suite-wide). Empty in production, where the table is untouched;
 *  also [] on 404 so the editor degrades to the baked seeds against a backend that
 *  predates the /themes routes (rather than surfacing a spurious error). */
export async function listThemes(): Promise<StoredTheme[]> {
  const res = await fetch(`${API}/public/themes`, { cache: 'no-store' })
  if (res.status === 404) return []
  return readJson(res)
}

export async function createTheme(theme: ThemeWrite & { key: string }): Promise<StoredTheme> {
  return readJson(await fetch(`${API}/themes`, jsonInit('POST', theme)))
}

export async function updateTheme(key: string, patch: Partial<ThemeWrite>): Promise<StoredTheme> {
  return readJson(await fetch(`${API}/themes/${encodeURIComponent(key)}`, jsonInit('PUT', patch)))
}

export async function deleteTheme(key: string): Promise<void> {
  const res = await fetch(`${API}/themes/${encodeURIComponent(key)}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) throw new Error(`themes API ${res.status}`)
}
