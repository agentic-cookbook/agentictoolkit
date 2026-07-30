import { describe, it, expect } from 'vitest'
import { resolveStoredSelection } from '../debug-env/selection-store'

const known = (id: string) => ['settings', 'environment', 'site-theme'].includes(id)

describe('resolveStoredSelection', () => {
  it('falls back when nothing was ever stored (first visit)', () => {
    expect(resolveStoredSelection(null, known, 'environment')).toBe('environment')
    expect(resolveStoredSelection(null, known, null)).toBeNull()
  })

  it('restores a stored selection that is still on offer', () => {
    expect(resolveStoredSelection('site-theme', known, 'environment')).toBe('site-theme')
    expect(resolveStoredSelection('settings', known, 'environment')).toBe('settings')
  })

  it('honors a DELIBERATE deselect instead of re-applying the default', () => {
    // The empty string is the stored "cleared" marker — distinct from an absent key, which is
    // the only case that may fall back. Without this the console would silently re-select its
    // default every time it was shown, undoing the user's deselect.
    expect(resolveStoredSelection('', known, 'environment')).toBeNull()
  })

  it('falls back on a STALE id (deleted theme, renamed area, withdrawn chat config)', () => {
    expect(resolveStoredSelection('chat-theme', known, 'environment')).toBe('environment')
    expect(resolveStoredSelection('gone', known, null)).toBeNull()
  })
})
