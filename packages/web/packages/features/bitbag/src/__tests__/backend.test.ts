// src/__tests__/backend.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChatResponse } from '@agentic-developer-toolkit/chat'
import { BitbagBackend } from '../backend'
import { FALLBACKS, INTRO } from '../voice'

describe('BitbagBackend', () => {
  it('drains the scripted intro in order, whatever is asked', async () => {
    const b = new BitbagBackend({ thinkMinMs: 0, thinkJitterMs: 0 })
    expect(await b.sendMessage('anything', [])).toBe(INTRO[0])
    expect(await b.sendMessage('anything else', [])).toBe(INTRO[1])
  })

  it('matches a seeded reply once the intro is drained', async () => {
    const b = new BitbagBackend({ thinkMinMs: 0, thinkJitterMs: 0 })
    await b.sendMessage('x', [])
    await b.sendMessage('x', [])
    expect(await b.sendMessage('what is the matrix rain?', [])).toMatch(/decorative/)
  })

  it('streams tokens and terminates with done', async () => {
    const b = new BitbagBackend({ thinkMinMs: 0, thinkJitterMs: 0, tokenMinMs: 0, tokenJitterMs: 0 })
    const events = []
    for await (const e of b.sendMessageStream('hello', [])) events.push(e)
    expect(events.at(-1)).toEqual({ type: 'done' })
    expect(events.filter((e) => e.type === 'token').length).toBeGreaterThan(0)
  })

  describe('timing defaults', () => {
    afterEach(() => {
      vi.useRealTimers()
      vi.restoreAllMocks()
    })

    it('floors sendMessage at the default 2000ms think delay', async () => {
      // Math.random() = 0 => think delay = thinkMinMs + 0 * thinkJitterMs = thinkMinMs.
      // Pins the 2000ms floor in isolation from the jitter term.
      vi.useFakeTimers()
      vi.spyOn(Math, 'random').mockReturnValue(0)
      const b = new BitbagBackend()

      let resolved = false
      const p = b.sendMessage('hi', []).then((r) => {
        resolved = true
        return r
      })

      await vi.advanceTimersByTimeAsync(1999)
      expect(resolved).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      await p
      expect(resolved).toBe(true)
    })

    it('caps sendMessage think delay at the default 3000ms jitter window', async () => {
      // With the 2000ms floor pinned by the previous test, Math.random() = 0.5
      // isolates the jitter constant: delay = 2000 + 0.5 * thinkJitterMs.
      // That only lands on 3500ms if thinkJitterMs is 3000, as bitbagMockBackend.ts specifies.
      vi.useFakeTimers()
      vi.spyOn(Math, 'random').mockReturnValue(0.5)
      const b = new BitbagBackend()

      let resolved = false
      const p = b.sendMessage('hi', []).then((r) => {
        resolved = true
        return r
      })

      await vi.advanceTimersByTimeAsync(3499)
      expect(resolved).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      await p
      expect(resolved).toBe(true)
    })

    it('floors the streamed token cadence at the default 45ms', async () => {
      // Drain the scripted intro on real timers first so the streamed reply
      // below is the deterministic seeded match, not an intro line.
      const b = new BitbagBackend({ thinkMinMs: 0, thinkJitterMs: 0 })
      await b.sendMessage('x', [])
      await b.sendMessage('x', [])

      // Isolate the think delay (0ms) so only the token cadence is under test.
      // Math.random() = 0 => token delay = tokenMinMs + 0 * tokenJitterMs = tokenMinMs.
      vi.useFakeTimers()
      vi.spyOn(Math, 'random').mockReturnValue(0)
      const iter = b.sendMessageStream('help', [])[Symbol.asyncIterator]()

      const p1 = iter.next()
      await vi.advanceTimersByTimeAsync(0) // flush the (0ms) think delay
      const r1 = await p1
      expect(r1.value).toEqual({ type: 'token', text: 'no' })

      let resolved = false
      const p2 = iter.next().then((r) => {
        resolved = true
        return r
      })

      await vi.advanceTimersByTimeAsync(44)
      expect(resolved).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      const r2 = await p2
      expect(resolved).toBe(true)
      // 'no commands. just talk...' splits into ['no', ' ', 'commands.', ...] —
      // the second event is the whitespace token, not 'done'.
      expect(r2.value).toEqual({ type: 'token', text: ' ' })
    })

    it('caps the streamed token cadence at the default 55ms jitter window', async () => {
      // Drain the scripted intro on real timers first so the streamed reply
      // below is the deterministic seeded match, not an intro line.
      const b = new BitbagBackend({ thinkMinMs: 0, thinkJitterMs: 0 })
      await b.sendMessage('x', [])
      await b.sendMessage('x', [])

      // With the 45ms floor pinned by the previous test, Math.random() = 0.4
      // isolates the jitter constant: delay = 45 + 0.4 * tokenJitterMs. That
      // only lands on 67ms if tokenJitterMs is 55, as bitbagMockBackend.ts specifies.
      vi.useFakeTimers()
      vi.spyOn(Math, 'random').mockReturnValue(0.4)
      const iter = b.sendMessageStream('help', [])[Symbol.asyncIterator]()

      const p1 = iter.next()
      await vi.advanceTimersByTimeAsync(0)
      const r1 = await p1
      expect(r1.value).toEqual({ type: 'token', text: 'no' })

      let resolved = false
      const p2 = iter.next().then((r) => {
        resolved = true
        return r
      })

      await vi.advanceTimersByTimeAsync(66)
      expect(resolved).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      const r2 = await p2
      expect(resolved).toBe(true)
      // 'no commands. just talk...' splits into ['no', ' ', 'commands.', ...] —
      // the second event is the whitespace token, not 'done'.
      expect(r2.value).toEqual({ type: 'token', text: ' ' })
    })

    it('honors custom token cadence options instead of the defaults', async () => {
      // Distinct, non-default minMs/jitterMs values with Math.random() = 0.5
      // catch a constructor that ignores the passed-in options (or swaps the
      // minMs/jitterMs mapping) even though the earlier default-pinning tests pass.
      vi.useFakeTimers()
      vi.spyOn(Math, 'random').mockReturnValue(0.5)
      const b = new BitbagBackend({
        thinkMinMs: 0,
        thinkJitterMs: 0,
        tokenMinMs: 10,
        tokenJitterMs: 20,
      })
      const iter = b.sendMessageStream('hi', [])[Symbol.asyncIterator]()

      const p1 = iter.next()
      await vi.advanceTimersByTimeAsync(0)
      await p1

      // expected delay = 10 + 0.5 * 20 = 20ms
      let resolved = false
      const p2 = iter.next().then((r) => {
        resolved = true
        return r
      })

      await vi.advanceTimersByTimeAsync(19)
      expect(resolved).toBe(false)
      await vi.advanceTimersByTimeAsync(1)
      await p2
      expect(resolved).toBe(true)
    })
  })

  it('draws every fallback exactly once before any repeat (reshuffle-when-empty)', async () => {
    const b = new BitbagBackend({ thinkMinMs: 0, thinkJitterMs: 0 })
    await b.sendMessage('x', []) // drains INTRO[0]
    await b.sendMessage('x', []) // drains INTRO[1]

    const drawn: ChatResponse[] = []
    for (let i = 0; i < FALLBACKS.length; i++) {
      // Doesn't match any SEEDED pattern, so every draw falls through to the bag.
      drawn.push(await b.sendMessage('zzzqqqxyz', []))
    }

    expect(new Set(drawn).size).toBe(FALLBACKS.length)
    expect([...drawn].sort()).toEqual([...FALLBACKS].sort())
  })
})
