import { describe, expect, it } from 'vitest'
import {
  FLAG_KEY_REQUIRED_MESSAGE,
  PRISTINE_FLAG_FORM,
  duplicateFlagKeyMessage,
  flagFormBlockedReason,
  isFlagFormDirty,
  type FlagFormContext,
  type FlagFormState,
} from '../settings-dialogs'

const CREATE_CTX: FlagFormContext = { editingMode: false, existingKeys: ['existing_flag'] }
const EDIT_CTX: FlagFormContext = { editingMode: true, existingKeys: ['existing_flag'] }

/** The dialog's gate, spelled out here the way both components spell it. */
const canSave = (form: FlagFormState, initial: FlagFormState, ctx: FlagFormContext) =>
  isFlagFormDirty(form, initial) && flagFormBlockedReason(form, ctx) === null

describe('the flag-dialog Save gate (create mode) — disabled at mount, enabled after a real edit', () => {
  const P = PRISTINE_FLAG_FORM

  it('is false at the pristine (all-blank) starting point', () => {
    expect(canSave(P, P, CREATE_CTX)).toBe(false)
  })

  it('becomes true once a non-blank key is typed', () => {
    expect(canSave({ ...P, key: 'dark_mode' }, P, CREATE_CTX)).toBe(true)
  })

  it('is false again if the key is cleared back to blank', () => {
    expect(canSave({ ...P, key: 'dark_mode', description: 'x' }, P, CREATE_CTX)).toBe(true)
    expect(canSave({ ...P, key: '', description: 'x' }, P, CREATE_CTX)).toBe(false)
  })

  it('whitespace-only key reads as pristine (trimmed), same as blank — not dirty, and blocked', () => {
    // Matches handleSubmit's own `!key.trim()` guard: a whitespace-only key is treated
    // identically to an empty one, so the dirty flag (which also drives the page's unsaved-work
    // guard) doesn't fire for content that can't be saved.
    expect(isFlagFormDirty({ ...P, key: '   ' }, P)).toBe(false)
    expect(flagFormBlockedReason({ ...P, key: '   ' }, CREATE_CTX)).toBe(
      FLAG_KEY_REQUIRED_MESSAGE,
    )
    expect(canSave({ ...P, key: '   ' }, P, CREATE_CTX)).toBe(false)
  })

  it("checking 'Enabled' alone is dirty but blocked without a key", () => {
    expect(isFlagFormDirty({ ...P, enabled: true }, P)).toBe(true)
    expect(flagFormBlockedReason({ ...P, enabled: true }, CREATE_CTX)).toBe(
      FLAG_KEY_REQUIRED_MESSAGE,
    )
    expect(canSave({ ...P, enabled: true }, P, CREATE_CTX)).toBe(false)
  })

  it('typing only a description alone is dirty but blocked without a key', () => {
    expect(isFlagFormDirty({ ...P, description: 'gates dark theme' }, P)).toBe(true)
    expect(flagFormBlockedReason({ ...P, description: 'gates dark theme' }, CREATE_CTX)).toBe(
      FLAG_KEY_REQUIRED_MESSAGE,
    )
    expect(canSave({ ...P, description: 'gates dark theme' }, P, CREATE_CTX)).toBe(false)
  })

  it('nothing is blocking once a free key exists', () => {
    expect(flagFormBlockedReason({ ...P, key: 'dark_mode' }, CREATE_CTX)).toBeNull()
  })

  // The check admin's copy of this gate was missing: a colliding key looks perfectly valid, so a
  // bare "non-blank" gate let Save light up on a click that could only ever produce a 409.
  it('is blocked when the key collides with an existing flag, and names the key', () => {
    const form = { ...P, key: 'existing_flag' }
    expect(isFlagFormDirty(form, P)).toBe(true)
    expect(flagFormBlockedReason(form, CREATE_CTX)).toBe(duplicateFlagKeyMessage('existing_flag'))
    expect(canSave(form, P, CREATE_CTX)).toBe(false)
  })

  it('collides on the TRIMMED key, since that is what the create body sends', () => {
    expect(flagFormBlockedReason({ ...P, key: '  existing_flag  ' }, CREATE_CTX)).toBe(
      duplicateFlagKeyMessage('existing_flag'),
    )
  })

  // Reason ORDER matters: it is the sentence a click would have produced, and handleSubmit
  // rejects a blank key before it looks for a collision.
  it('reports the blank key first, never a collision with the empty string', () => {
    expect(flagFormBlockedReason({ ...P, key: ' ' }, { editingMode: false, existingKeys: [''] })).toBe(
      FLAG_KEY_REQUIRED_MESSAGE,
    )
  })
})

describe('the flag-dialog Save gate (edit mode) — key checks don’t apply', () => {
  const initial: FlagFormState = { key: 'existing_flag', description: 'Dark theme', enabled: false }

  it('is false at mount (loaded, unedited)', () => {
    expect(canSave(initial, initial, EDIT_CTX)).toBe(false)
  })

  it('is true once Enabled is toggled', () => {
    expect(canSave({ ...initial, enabled: true }, initial, EDIT_CTX)).toBe(true)
  })

  it("the flag's own key doesn't read as a collision with itself", () => {
    expect(flagFormBlockedReason(initial, EDIT_CTX)).toBeNull()
  })
})

/**
 * The submit path sends `key.trim()` and `description.trim()`, so whitespace-only differences
 * would enable Save and then send a byte-identical body — the no-op write this gate exists to
 * prevent.
 */
describe('the flag-dialog dirty check is trim-consistent with what submit sends', () => {
  const initial: FlagFormState = { key: 'dark_mode', description: 'Dark theme', enabled: true }

  it('a trailing space in the description is not a change', () => {
    expect(isFlagFormDirty({ ...initial, description: 'Dark theme ' }, initial)).toBe(false)
  })

  it('a trailing space in the key is not a change', () => {
    expect(isFlagFormDirty({ ...initial, key: 'dark_mode  ' }, initial)).toBe(false)
  })

  it('but real description text still is', () => {
    expect(isFlagFormDirty({ ...initial, description: 'Dark theme v2' }, initial)).toBe(true)
  })
})
