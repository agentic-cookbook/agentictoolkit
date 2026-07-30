import { describe, it, expect } from 'vitest'
import { parseEnvOverride, resolveEffectiveEnv } from '../header/envOverride'

describe('parseEnvOverride', () => {
  it('accepts every known env', () => {
    expect(parseEnvOverride('production')).toBe('production')
    expect(parseEnvOverride('staging')).toBe('staging')
    expect(parseEnvOverride('testing')).toBe('testing')
    expect(parseEnvOverride('local')).toBe('local')
  })
  it('rejects absent or unknown values', () => {
    expect(parseEnvOverride(null)).toBeNull()
    expect(parseEnvOverride(undefined)).toBeNull()
    expect(parseEnvOverride('')).toBeNull()
    expect(parseEnvOverride('prod')).toBeNull()
    expect(parseEnvOverride('PRODUCTION')).toBeNull()
  })
})

describe('resolveEffectiveEnv', () => {
  it('prefers the override when set (so the Debug menu can simulate prod)', () => {
    expect(resolveEffectiveEnv('production', 'local')).toBe('production')
    expect(resolveEffectiveEnv('production', 'testing')).toBe('production')
    expect(resolveEffectiveEnv('staging', null)).toBe('staging')
  })
  it('falls back to the detected env when no override', () => {
    expect(resolveEffectiveEnv(null, 'testing')).toBe('testing')
    expect(resolveEffectiveEnv(null, 'local')).toBe('local')
    expect(resolveEffectiveEnv(null, null)).toBeNull()
  })
})
