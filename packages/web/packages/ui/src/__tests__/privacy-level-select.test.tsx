/** Unit tests for the privacy-level ↔ wire-word conversion maps beside PrivacyLevelSelect. */
import { describe, it, expect } from 'vitest'
import {
  PRIVACY_WIRE_VALUE,
  PRIVACY_LEVEL_FROM_WIRE,
  PRIVACY_AUDIENCE_MASK,
} from '../components/privacy-level-select'

describe('privacy level ↔ wire word', () => {
  it('spells only-me as private on the wire', () => {
    expect(PRIVACY_WIRE_VALUE['only-me']).toBe('private')
    expect(PRIVACY_WIRE_VALUE.hub).toBe('hub')
    expect(PRIVACY_WIRE_VALUE.public).toBe('public')
  })

  it('round-trips every level', () => {
    for (const level of ['only-me', 'hub', 'public'] as const) {
      expect(PRIVACY_LEVEL_FROM_WIRE(PRIVACY_WIRE_VALUE[level])).toBe(level)
    }
  })

  it('falls back to only-me on an unknown word', () => {
    // A word the backend CHECK cannot produce must not render as "Public".
    expect(PRIVACY_LEVEL_FROM_WIRE('unlisted')).toBe('only-me')
    expect(PRIVACY_LEVEL_FROM_WIRE('')).toBe('only-me')
  })

  it('leaves the per-row mask map untouched', () => {
    // The two maps answer different questions and must not be collapsed: a per-ROW grant is an
    // integer audience mask, a PAGE switch is a stored word.
    expect(PRIVACY_AUDIENCE_MASK['only-me']).toBe(0)
  })
})
