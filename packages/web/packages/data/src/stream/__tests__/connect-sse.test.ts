// The transport's own tests. jsdom ships no EventSource, so the one below IS the browser
// for these cases — which is fine, because what is being asserted is what `connectSse`
// asks the browser to do (which names it listens for, and whether it lets go of all of
// them), not what the browser does with it.
//
// The multi-name cases exist because `event` used to be a single string. A caller with
// three event names on one stream — shipr's run log says `line`, `state` and `end` about
// one run — had two bad options: open three EventSources against one route, or listen for
// one name and lose the other two. Both are silent: three connections look like one to a
// developer reading the code, and dropped events look like a stream that has gone quiet.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const token = vi.hoisted(() => ({ read: vi.fn(() => 'tok') }))
vi.mock('@agentic-toolkit/auth/client', () => ({
  readAccessToken: token.read,
}))

import { connectSse } from '../index'

/** Every EventSource this file's `connectSse` calls have constructed, newest last. */
const sources: FakeEventSource[] = []

class FakeEventSource {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSED = 2

  readyState = FakeEventSource.OPEN
  onerror: (() => void) | null = null
  closed = false
  /** name → the listeners registered for it, in registration order. */
  readonly listeners = new Map<string, EventListenerOrEventListenerObject[]>()

  constructor(readonly url: string) {
    sources.push(this)
  }

  addEventListener(name: string, fn: EventListenerOrEventListenerObject): void {
    const list = this.listeners.get(name) ?? []
    list.push(fn)
    this.listeners.set(name, list)
  }

  removeEventListener(name: string, fn: EventListenerOrEventListenerObject): void {
    const list = (this.listeners.get(name) ?? []).filter((f) => f !== fn)
    if (list.length === 0) this.listeners.delete(name)
    else this.listeners.set(name, list)
  }

  close(): void {
    this.closed = true
    this.readyState = FakeEventSource.CLOSED
  }

  /** Dispatch as the browser would: to the listeners registered under THAT name only. */
  emit(name: string, data: string): void {
    for (const fn of this.listeners.get(name) ?? []) {
      const event = { type: name, data } as unknown as Event
      if (typeof fn === 'function') fn(event)
      else fn.handleEvent(event)
    }
  }

  /** How many names are still being listened for — the number that has to reach 0. */
  get listenedNames(): string[] {
    return [...this.listeners.keys()].sort()
  }
}

const newest = () => sources[sources.length - 1]!

beforeEach(() => {
  sources.length = 0
  token.read.mockReturnValue('tok')
  vi.stubGlobal('EventSource', FakeEventSource)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('connectSse — which names it listens for', () => {
  it('listens for the one name a single-name caller asked for', () => {
    const onEvent = vi.fn()
    const handle = connectSse({
      url: '/api/notifications/stream',
      event: 'notification',
      onEvent,
      onPoll: vi.fn(),
    })
    expect(newest().listenedNames).toEqual(['notification'])
    newest().emit('notification', '{}')
    expect(onEvent).toHaveBeenCalledTimes(1)
    handle.close()
  })

  it('listens for EVERY name a list caller asked for, on ONE connection', () => {
    const onEvent = vi.fn()
    const handle = connectSse({
      url: '/api/shipr/stream/runs/r1',
      event: ['line', 'state', 'end'],
      onEvent,
      onPoll: vi.fn(),
    })
    // One connection, not three. This is the assertion the old single-string signature
    // made impossible to satisfy without opening a stream per name.
    expect(sources).toHaveLength(1)
    expect(newest().listenedNames).toEqual(['end', 'line', 'state'])
    handle.close()
  })

  it('tells the caller WHICH name carried each payload', () => {
    // Without the name, three interleaved kinds arrive as one undifferentiated list of
    // strings and the caller has to guess from the payload's shape which it just got.
    const seen: Array<[string, string]> = []
    const handle = connectSse({
      url: '/api/shipr/stream/runs/r1',
      event: ['line', 'state', 'end'],
      onEvent: (data, event) => seen.push([event, data]),
      onPoll: vi.fn(),
    })
    newest().emit('line', '{"text":"cloning"}')
    newest().emit('state', '{"state":"running"}')
    newest().emit('end', '{}')
    expect(seen).toEqual([
      ['line', '{"text":"cloning"}'],
      ['state', '{"state":"running"}'],
      ['end', '{}'],
    ])
    handle.close()
  })

  it('ignores a name it was not asked for', () => {
    const onEvent = vi.fn()
    const handle = connectSse({
      url: '/api/shipr/stream',
      event: ['run'],
      onEvent,
      onPoll: vi.fn(),
    })
    newest().emit('line', 'not mine')
    expect(onEvent).not.toHaveBeenCalled()
    handle.close()
  })
})

describe('connectSse — letting go', () => {
  it('removes EVERY listener on close, not just the first', () => {
    // The asymmetry this guards against is the one a per-name add with a single-name
    // remove produces: the stream closes, but the listeners outlive it and hold the
    // caller's closure — and its component — alive.
    const handle = connectSse({
      url: '/api/shipr/stream/runs/r1',
      event: ['line', 'state', 'end'],
      onEvent: vi.fn(),
      onPoll: vi.fn(),
    })
    const source = newest()
    handle.close()
    expect(source.listenedNames).toEqual([])
    expect(source.closed).toBe(true)
  })

  it('drops every listener before falling back to polling on a hard close', () => {
    const onPoll = vi.fn()
    const handle = connectSse({
      url: '/api/shipr/stream/runs/r1',
      event: ['line', 'state', 'end'],
      onEvent: vi.fn(),
      onPoll,
    })
    const source = newest()
    // A 401 on reconnect once the token expired: the browser gives up for good.
    source.readyState = FakeEventSource.CLOSED
    source.onerror?.()
    expect(source.listenedNames).toEqual([])
    handle.close()
  })

  it('leaves a transient blip to the browser and keeps listening', () => {
    const handle = connectSse({
      url: '/api/shipr/stream/runs/r1',
      event: ['line', 'state'],
      onEvent: vi.fn(),
      onPoll: vi.fn(),
    })
    const source = newest()
    source.readyState = FakeEventSource.CONNECTING
    source.onerror?.()
    expect(source.listenedNames).toEqual(['line', 'state'])
    expect(source.closed).toBe(false)
    handle.close()
  })
})

describe('connectSse — the token', () => {
  it('rides the query string, because EventSource cannot set a header', () => {
    const handle = connectSse({
      url: '/api/shipr/stream/runs/r1',
      event: ['line'],
      onEvent: vi.fn(),
      onPoll: vi.fn(),
    })
    expect(newest().url).toBe('/api/shipr/stream/runs/r1?access_token=tok')
    handle.close()
  })

  it('appends with `&` when the url already carries a query', () => {
    const handle = connectSse({
      url: '/api/shipr/stream?workspace=w1',
      event: ['run'],
      onEvent: vi.fn(),
      onPoll: vi.fn(),
    })
    expect(newest().url).toBe('/api/shipr/stream?workspace=w1&access_token=tok')
    handle.close()
  })

  it('polls instead of opening a tokenless stream', () => {
    // The post-login race: a first mount before the token is written. Opening anyway would
    // spend the connection on a guaranteed 401.
    token.read.mockReturnValue('')
    const handle = connectSse({
      url: '/api/shipr/stream',
      event: ['run'],
      onEvent: vi.fn(),
      onPoll: vi.fn(),
    })
    expect(sources).toHaveLength(0)
    handle.close()
  })
})
