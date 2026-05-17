import { describe, it, expect } from 'vitest'
import { MockBackend } from '../backends/MockBackend'

describe('MockBackend', () => {
  it('returns canned response for known commands', async () => {
    const backend = new MockBackend({ delayMs: 0 })
    const result = await backend.sendMessage('text', [])
    expect(result).toBe('Just a plain text reply with no panels or extras.')
  })

  it('is case-insensitive', async () => {
    const backend = new MockBackend({ delayMs: 0 })
    const result = await backend.sendMessage('HELLO', [])
    expect(result).toContain('Try:')
  })

  it('trims whitespace', async () => {
    const backend = new MockBackend({ delayMs: 0 })
    const result = await backend.sendMessage('  text  ', [])
    expect(result).toBe('Just a plain text reply with no panels or extras.')
  })

  it('returns fallback for unknown messages', async () => {
    const backend = new MockBackend({ delayMs: 0 })
    const result = await backend.sendMessage('unknown command', [])
    expect(result).toContain("I don't know that one")
    expect(result).toContain('hello')
  })

  it('returns rich response objects', async () => {
    const backend = new MockBackend({ delayMs: 0 })
    const result = await backend.sendMessage('small panel', [])
    expect(typeof result).toBe('object')
    if (typeof result === 'object') {
      expect(result.text).toBe('Here are some quick links for you.')
      expect(result.popover?.title).toBe('Quick Reference')
      expect(result.content).toHaveLength(1)
    }
  })

  it('accepts custom responses', async () => {
    const backend = new MockBackend({
      delayMs: 0,
      responses: { greet: 'Hi there!' },
    })
    const result = await backend.sendMessage('greet', [])
    expect(result).toBe('Hi there!')
  })

  it('custom responses merge with defaults', async () => {
    const backend = new MockBackend({
      delayMs: 0,
      responses: { greet: 'Hi there!' },
    })
    // Custom works
    expect(await backend.sendMessage('greet', [])).toBe('Hi there!')
    // Default still works
    expect(await backend.sendMessage('text', [])).toBe(
      'Just a plain text reply with no panels or extras.',
    )
  })

  it('respects delay range', async () => {
    const backend = new MockBackend({ delayMs: [50, 100] })
    const start = Date.now()
    await backend.sendMessage('text', [])
    const elapsed = Date.now() - start
    expect(elapsed).toBeGreaterThanOrEqual(45) // small tolerance
  })
})
