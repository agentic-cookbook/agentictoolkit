import { describe, it, expect } from 'vitest'
import {
  getThemeById,
  isValidThemeId,
  DEFAULT_THEME_ID,
  SHIKI_VARIANT_BY_ID,
} from '../themes/registry'

describe('theme registry', () => {
  describe('getThemeById', () => {
    it('returns the requested theme', () => {
      expect(getThemeById('dark').id).toBe('dark')
    })

    // Fallback must use DEFAULT_THEME_ID by id, not by array position, so
    // reordering VIEWER_THEMES doesn't silently change the fallback.
    it('falls back to DEFAULT_THEME_ID for an unknown id', () => {
      expect(getThemeById('does-not-exist').id).toBe(DEFAULT_THEME_ID)
    })
  })

  describe('isValidThemeId', () => {
    it('returns true for a known theme id', () => {
      expect(isValidThemeId('sepia')).toBe(true)
    })

    it('returns false for an unknown id', () => {
      expect(isValidThemeId('nope')).toBe(false)
    })

    it('returns false for null', () => {
      expect(isValidThemeId(null)).toBe(false)
    })
  })

  describe('SHIKI_VARIANT_BY_ID', () => {
    it('maps dark → "dark"', () => {
      expect(SHIKI_VARIANT_BY_ID['dark']).toBe('dark')
    })

    it('maps github → "light"', () => {
      expect(SHIKI_VARIANT_BY_ID['github']).toBe('light')
    })
  })
})
