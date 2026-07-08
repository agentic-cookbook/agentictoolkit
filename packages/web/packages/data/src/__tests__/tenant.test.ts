import { describe, expect, it } from 'vitest'
import { tenantIdFromToken } from '../tenant'

// Build a fake JWT whose middle segment is the base64url-encoded claims — the
// real shape `tenantIdFromToken` (via `atob`) decodes. Browser-native `btoa`
// (no Node `Buffer`) keeps this package's tests platform-pure.
const base64url = (json: string) =>
  btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const claims = (obj: object) => `x.${base64url(JSON.stringify(obj))}.y`

describe('tenantIdFromToken', () => {
  it('reads ecosystem_id (the real adh backend claim) first', () => {
    expect(tenantIdFromToken(claims({ ecosystem_id: 'e1' }))).toBe('e1')
  })
  it('prefers ecosystem_id over the tenant_id / project_id fallbacks', () => {
    expect(
      tenantIdFromToken(claims({ ecosystem_id: 'e1', tenant_id: 't1', project_id: 'p1' })),
    ).toBe('e1')
  })
  it('falls back to tenant_id, then project_id, in order', () => {
    expect(tenantIdFromToken(claims({ tenant_id: 't1', project_id: 'p1' }))).toBe('t1')
    expect(tenantIdFromToken(claims({ project_id: 'p1' }))).toBe('p1')
  })
  it('returns null when no tenant claim is present, or the token is absent/garbage', () => {
    expect(tenantIdFromToken(claims({ sub: 'user-1' }))).toBeNull()
    expect(tenantIdFromToken(null)).toBeNull()
    expect(tenantIdFromToken('garbage')).toBeNull()
  })
})
