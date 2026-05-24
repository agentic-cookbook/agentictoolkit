import { describe, it, expect } from 'vitest'
import { isAdmin, hasCapability, type AuthUser } from '../types'

function user(capabilities: string[]): AuthUser {
  return { id: '1', email: 'a@b.c', name: 'A', avatarUrl: '', capabilities, authMethods: [], attributes: [] }
}

describe('capabilities helpers', () => {
  it('isAdmin is true only when capabilities include "admin"', () => {
    expect(isAdmin(user(['admin']))).toBe(true)
    expect(isAdmin(user(['user', 'admin']))).toBe(true)
    expect(isAdmin(user(['user']))).toBe(false)
    expect(isAdmin(null)).toBe(false)
  })

  it('hasCapability checks an arbitrary capability', () => {
    expect(hasCapability(user(['billing']), 'billing')).toBe(true)
    expect(hasCapability(user([]), 'billing')).toBe(false)
    expect(hasCapability(null, 'billing')).toBe(false)
  })
})
