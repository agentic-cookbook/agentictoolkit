/** Unit tests for the shared CRUD capability model. */
import { describe, it, expect } from 'vitest'
import {
  CRUD_KEYS,
  CRUD_LETTER,
  noAccess,
  readOnly,
  clampToParent,
  type Crud,
} from '../components/crud'

const all: Crud = { create: true, read: true, update: true, delete: true }

describe('crud model', () => {
  it('CRUD_KEYS and CRUD_LETTER agree on the four capabilities', () => {
    expect(CRUD_KEYS).toEqual(['create', 'read', 'update', 'delete'])
    expect(CRUD_KEYS.map((k) => CRUD_LETTER[k])).toEqual(['C', 'R', 'U', 'D'])
  })

  it('noAccess() is the most-restrictive default (all false)', () => {
    expect(noAccess()).toEqual({ create: false, read: false, update: false, delete: false })
  })

  it('readOnly() grants read and nothing else', () => {
    expect(readOnly()).toEqual({ create: false, read: true, update: false, delete: false })
  })

  it('clampToParent keeps a capability only when the parent also allows it', () => {
    const child: Crud = { create: true, read: true, update: true, delete: true }
    const parent: Crud = { create: false, read: true, update: false, delete: true }
    expect(clampToParent(child, parent)).toEqual({
      create: false, // parent forbids
      read: true,
      update: false, // parent forbids
      delete: true,
    })
  })

  it('clamping to an all-allowing parent is a no-op; to noAccess() zeroes everything', () => {
    expect(clampToParent(readOnly(), all)).toEqual(readOnly())
    expect(clampToParent(all, noAccess())).toEqual(noAccess())
  })
})
