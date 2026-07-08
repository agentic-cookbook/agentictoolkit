import { describe, expect, it } from 'vitest'
import { tenantIdFromToken } from '../tenant'

// Build a fake JWT whose middle segment is the base64url-encoded claims — the
// real shape `tenantIdFromToken` (via `atob`) decodes. Browser-native `btoa`
// (no Node `Buffer`) keeps this package's tests platform-pure.
const base64url = (json: string) =>
  btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const claims = (obj: object) => `x.${base64url(JSON.stringify(obj))}.y`

describe('tenantIdFromToken', () => {
  it('reads tenant_id', () => {
    expect(tenantIdFromToken(claims({ tenant_id: 't1' }))).toBe('t1')
  })
  it('falls back to project_id, then null', () => {
    expect(tenantIdFromToken(claims({ project_id: 'p1' }))).toBe('p1')
    expect(tenantIdFromToken(null)).toBeNull()
    expect(tenantIdFromToken('garbage')).toBeNull()
  })
})
