// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest'
import { AdhChatBackend, type KeyValueStore } from '../visitor-chat'
// The chat contract types are a traceable local copy here, not a cross-submodule
// dependency — see ../persona-chat/chat-types.ts.
import type { ChatStreamEvent } from '../persona-chat/chat-types'

const SLUG = 'bitbag'
const TOKEN_KEY = `bitbag.visitor.${SLUG}.token`
const CONVO_KEY = `bitbag.visitor.${SLUG}.conversation`
const FUTURE = new Date(Date.now() + 3_600_000).toISOString()

/** An in-memory KeyValueStore — the seam that makes the token/conversation lifecycle
 *  observable without a real localStorage. */
function memStore(seed: Record<string, string> = {}): KeyValueStore & { map: Map<string, string> } {
  const map = new Map(Object.entries(seed))
  return {
    map,
    get: (k) => map.get(k) ?? null,
    set: (k, v) => void map.set(k, v),
    remove: (k) => void map.delete(k),
  }
}

/** One recorded fetch call. */
interface Call {
  url: string
  method: string
  headers: Record<string, string>
  body?: string
}

/** A programmable fetch: a handler decides each response from the recorded call and a
 *  per-URL hit count, so tests can make e.g. the FIRST turn 401 and the RETRY 200. */
function fakeFetch(handler: (call: Call, hit: number) => Response): {
  fetchImpl: typeof fetch
  calls: Call[]
} {
  const calls: Call[] = []
  const counts = new Map<string, number>()
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = (init?.method ?? 'GET').toUpperCase()
    const headers = (init?.headers ?? {}) as Record<string, string>
    const body = typeof init?.body === 'string' ? init.body : undefined
    const call: Call = { url, method, headers, body }
    calls.push(call)
    const key = `${method} ${url}`
    const hit = (counts.get(key) ?? 0) + 1
    counts.set(key, hit)
    return handler(call, hit)
  }) as typeof fetch
  return { fetchImpl, calls }
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status })
}

/** An SSE turn response body — the exact wire shape the backend emits. */
function sse(...blocks: string[]): Response {
  return new Response(blocks.join(''), { status: 200 })
}

const OPEN = 'event: open\ndata: \n\n'
const token = (t: string) => `event: token\ndata: {"text":${JSON.stringify(t)}}\n\n`
const DONE = 'event: done\ndata: {}\n\n'

/** Default happy-path router: mint → bootstrap → create conversation → SSE turn. */
function happyHandler(convoId = 'c1'): (call: Call) => Response {
  return (call) => {
    if (call.url.endsWith('/visitor-tokens')) {
      return json({ token: 'tok-1', expiresAt: FUTURE, personaId: 'p1' }, 201)
    }
    if (call.url.endsWith('/persona/bootstrap')) {
      return json({ persona: { name: 'bitbag' }, chat: { limits: { maxConversationLength: 200 } } })
    }
    if (call.url.endsWith('/conversations')) return json({ id: convoId }, 201)
    if (call.url.endsWith('/turns')) return sse(OPEN, token('Hi '), token('there'), DONE)
    throw new Error(`unexpected url ${call.url}`)
  }
}

async function drain(backend: AdhChatBackend, text = 'hello'): Promise<ChatStreamEvent[]> {
  const out: ChatStreamEvent[] = []
  for await (const evt of backend.sendMessageStream(text, [])) out.push(evt)
  return out
}

describe('AdhChatBackend — token lifecycle', () => {
  it('mints a token when none is stored, persisting it (and clearing any convo id)', async () => {
    const store = memStore({ [CONVO_KEY]: 'stale' })
    const { fetchImpl, calls } = fakeFetch(happyHandler())
    const backend = new AdhChatBackend({ personaSlug: SLUG, fetchImpl, store })
    await drain(backend)

    const mint = calls.find((c) => c.url.endsWith('/visitor-tokens'))
    expect(mint?.method).toBe('POST')
    expect(mint?.url).toBe('/api/public/personas/bitbag/visitor-tokens')
    expect(JSON.parse(store.map.get(TOKEN_KEY)!)).toMatchObject({ token: 'tok-1', personaId: 'p1' })
    // The new token is a new session: the pre-existing (foreign) conversation id is dropped,
    // then a fresh one is created and stored.
    expect(store.map.get(CONVO_KEY)).toBe('c1')
  })

  it('reuses a stored, unexpired token (no mint)', async () => {
    const store = memStore({
      [TOKEN_KEY]: JSON.stringify({ token: 'stored', expiresAt: FUTURE, personaId: 'p1' }),
      [CONVO_KEY]: 'c9',
    })
    const { fetchImpl, calls } = fakeFetch(happyHandler('c9'))
    const backend = new AdhChatBackend({ personaSlug: SLUG, fetchImpl, store })
    await drain(backend)

    expect(calls.some((c) => c.url.endsWith('/visitor-tokens'))).toBe(false)
    // Bearer is the stored token, and the stored conversation is resumed (no create call).
    const turn = calls.find((c) => c.url.endsWith('/turns'))
    expect(turn?.headers.Authorization).toBe('Bearer stored')
    expect(turn?.url).toBe('/api/public/visitor-chat/conversations/c9/turns')
    expect(calls.some((c) => c.method === 'POST' && c.url.endsWith('/conversations'))).toBe(false)
  })

  it('treats a token within the expiry skew as expired and re-mints', async () => {
    const nearlyExpired = new Date(Date.now() + 5_000).toISOString() // < 30s skew
    const store = memStore({
      [TOKEN_KEY]: JSON.stringify({ token: 'old', expiresAt: nearlyExpired, personaId: 'p1' }),
    })
    const { fetchImpl, calls } = fakeFetch(happyHandler())
    const backend = new AdhChatBackend({ personaSlug: SLUG, fetchImpl, store })
    await drain(backend)

    expect(calls.some((c) => c.url.endsWith('/visitor-tokens'))).toBe(true)
    expect(JSON.parse(store.map.get(TOKEN_KEY)!).token).toBe('tok-1')
  })

  it('transparently re-mints on a 401 turn and retries with a fresh conversation', async () => {
    const store = memStore()
    let mints = 0
    const { fetchImpl, calls } = fakeFetch((call) => {
      if (call.url.endsWith('/visitor-tokens')) {
        mints += 1
        return json({ token: `tok-${mints}`, expiresAt: FUTURE, personaId: 'p1' }, 201)
      }
      if (call.url.endsWith('/persona/bootstrap')) return json({ persona: { name: 'bitbag' } })
      if (call.url.endsWith('/conversations')) return json({ id: `c${mints}` }, 201)
      if (call.url.endsWith('/turns')) {
        // First turn (under tok-1 / c1) is unauthorized; the retry under the fresh token succeeds.
        return call.headers.Authorization === 'Bearer tok-1'
          ? new Response('', { status: 401 })
          : sse(OPEN, token('ok'), DONE)
      }
      throw new Error(`unexpected ${call.url}`)
    })
    const backend = new AdhChatBackend({ personaSlug: SLUG, fetchImpl, store })
    const events = await drain(backend)

    expect(mints).toBe(2)
    // Two conversations created (the first orphaned by the re-mint), two turn attempts.
    expect(calls.filter((c) => c.method === 'POST' && c.url.endsWith('/conversations')).length).toBe(2)
    expect(calls.filter((c) => c.url.endsWith('/turns')).length).toBe(2)
    expect(events.some((e) => e.type === 'token' && e.text === 'ok')).toBe(true)
  })

  it('recovers a reaped conversation on a 404 turn (drops the dead id, retries fresh, same token)', async () => {
    const store = memStore({
      [TOKEN_KEY]: JSON.stringify({ token: 'stored', expiresAt: FUTURE, personaId: 'p1' }),
      [CONVO_KEY]: 'dead',
    })
    const { fetchImpl, calls } = fakeFetch((call) => {
      if (call.url.endsWith('/persona/bootstrap')) return json({ persona: { name: 'bitbag' } })
      if (call.url.endsWith('/conversations')) return json({ id: 'fresh' }, 201)
      if (call.url.endsWith('/turns')) {
        // The stored 'dead' conversation was reaped server-side (expiry window elapsed) → 404.
        // The retry under a freshly created conversation succeeds; the token never changes.
        return call.url.includes('/conversations/dead/')
          ? new Response('', { status: 404 })
          : sse(OPEN, token('ok'), DONE)
      }
      throw new Error(`unexpected ${call.url}`)
    })
    const backend = new AdhChatBackend({ personaSlug: SLUG, fetchImpl, store })
    const events = await drain(backend)

    // No re-mint — the token was valid; only the conversation was recreated.
    expect(calls.some((c) => c.url.endsWith('/visitor-tokens'))).toBe(false)
    expect(calls.filter((c) => c.method === 'POST' && c.url.endsWith('/conversations')).length).toBe(1)
    expect(calls.filter((c) => c.url.endsWith('/turns')).length).toBe(2)
    // The dead id is replaced by the fresh one, so the next message resumes the live convo.
    expect(store.map.get(CONVO_KEY)).toBe('fresh')
    expect(events.some((e) => e.type === 'token' && e.text === 'ok')).toBe(true)
  })

  it('drops the stored conversation on a re-mint forced by a BOOTSTRAP 401 (conversations are token-scoped)', async () => {
    // Deliberate, not a leak: server-side a visitor conversation is owned by the token row that
    // created it (routes/visitor.ts createVisitorConversation ← `visitorTokenId: auth.id`) and every
    // read filters on that id (llm/persistence.ts getVisitorConversation), while each mint inserts a
    // NEW token row (auth/tokens/repo.ts createApiToken → randomUUID). So once any authed request —
    // here the bootstrap GET, where nothing was mid-conversation — forces a re-mint, the stored id is
    // unreachable by the new token no matter how much of its own 30-day TTL is left. Clearing it is
    // what keeps the next turn from being a guaranteed 404; the turn count below pins that.
    const store = memStore({
      // The client believes this token is good (unexpired), so it is the SERVER that rejects it —
      // revoked, backend restarted, clock skew — which is the only way a 401 reaches authedFetch.
      [TOKEN_KEY]: JSON.stringify({ token: 'stale', expiresAt: FUTURE, personaId: 'p1' }),
      [CONVO_KEY]: 'old',
    })
    let mints = 0
    const { fetchImpl, calls } = fakeFetch((call) => {
      if (call.url.endsWith('/visitor-tokens')) {
        mints += 1
        return json({ token: 'tok-1', expiresAt: FUTURE, personaId: 'p1' }, 201)
      }
      if (call.url.endsWith('/persona/bootstrap')) {
        return call.headers.Authorization === 'Bearer stale'
          ? new Response('', { status: 401 })
          : json({ persona: { name: 'bitbag' } })
      }
      if (call.url.endsWith('/conversations')) return json({ id: 'fresh' }, 201)
      if (call.url.endsWith('/turns')) return sse(OPEN, token('ok'), DONE)
      throw new Error(`unexpected ${call.url}`)
    })
    const backend = new AdhChatBackend({ personaSlug: SLUG, fetchImpl, store })
    const events = await drain(backend)

    expect(mints).toBe(1)
    expect(JSON.parse(store.map.get(TOKEN_KEY)!).token).toBe('tok-1')
    // The old id is abandoned outright: never POSTed to, and replaced in the store by a conversation
    // the NEW token owns. One turn attempt — preserving the old id would spend an extra doomed 404.
    expect(calls.some((c) => c.url.includes('/conversations/old'))).toBe(false)
    expect(calls.filter((c) => c.url.endsWith('/turns')).length).toBe(1)
    expect(store.map.get(CONVO_KEY)).toBe('fresh')
    expect(events.some((e) => e.type === 'token' && e.text === 'ok')).toBe(true)
  })
})

describe('AdhChatBackend — conversation + bootstrap', () => {
  it('lazily creates a conversation on the first message and stores its id', async () => {
    const store = memStore()
    const { fetchImpl, calls } = fakeFetch(happyHandler('conv-42'))
    const backend = new AdhChatBackend({ personaSlug: SLUG, fetchImpl, store })
    await drain(backend)

    const create = calls.find((c) => c.method === 'POST' && c.url.endsWith('/conversations'))
    expect(create?.url).toBe('/api/public/visitor-chat/conversations')
    expect(create?.body).toBe('{}')
    expect(store.map.get(CONVO_KEY)).toBe('conv-42')
  })

  it('reads bootstrap once and reports it via onBootstrap', async () => {
    const store = memStore()
    const seen: unknown[] = []
    const { fetchImpl, calls } = fakeFetch(happyHandler())
    const backend = new AdhChatBackend({
      personaSlug: SLUG,
      fetchImpl,
      store,
      onBootstrap: (info) => seen.push(info),
    })
    await drain(backend, 'one')
    await drain(backend, 'two')

    expect(seen).toEqual([{ personaName: 'bitbag', maxConversationLength: 200 }])
    // Bootstrap fetched exactly once across two turns.
    expect(calls.filter((c) => c.url.endsWith('/persona/bootstrap')).length).toBe(1)
  })
})

describe('AdhChatBackend — streaming + fail-closed gates', () => {
  it('streams tokens and a done event through sendMessageStream', async () => {
    const { fetchImpl } = fakeFetch(happyHandler())
    const backend = new AdhChatBackend({ personaSlug: SLUG, fetchImpl, store: memStore() })
    const events = await drain(backend)
    expect(events).toEqual([
      { type: 'token', text: 'Hi ' },
      { type: 'token', text: 'there' },
      { type: 'done' },
    ])
  })

  it('sendMessage aggregates the stream into a single string', async () => {
    const { fetchImpl } = fakeFetch(happyHandler())
    const backend = new AdhChatBackend({ personaSlug: SLUG, fetchImpl, store: memStore() })
    await expect(backend.sendMessage('hello', [])).resolves.toBe('Hi there')
  })

  it('maps a 409 length cap to a friendly error and drops the maxed-out conversation', async () => {
    const store = memStore()
    const { fetchImpl } = fakeFetch((call) => {
      if (call.url.endsWith('/visitor-tokens')) return json({ token: 't', expiresAt: FUTURE, personaId: 'p' }, 201)
      if (call.url.endsWith('/persona/bootstrap')) return json({ chat: { limits: { maxConversationLength: 200 } } })
      if (call.url.endsWith('/conversations')) return json({ id: 'full' }, 201)
      if (call.url.endsWith('/turns')) return new Response('', { status: 409 })
      throw new Error('unexpected')
    })
    const backend = new AdhChatBackend({ personaSlug: SLUG, fetchImpl, store })
    const events = await drain(backend)

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: 'error' })
    expect((events[0] as { message: string }).message).toContain('200-message limit')
    // Next message must start fresh, so the full conversation id is cleared.
    expect(store.map.has(CONVO_KEY)).toBe(false)
  })

  it('an `ended` event drops the stored conversation so the next message starts fresh', async () => {
    const store = memStore()
    const { fetchImpl } = fakeFetch((call) => {
      if (call.url.endsWith('/visitor-tokens')) return json({ token: 't', expiresAt: FUTURE, personaId: 'p' }, 201)
      if (call.url.endsWith('/persona/bootstrap')) return json({})
      if (call.url.endsWith('/conversations')) return json({ id: 'over' }, 201)
      // The persona said goodbye and ended the chat. No `done` follows it on the wire.
      if (call.url.endsWith('/turns'))
        return sse(OPEN, token('goodbye'), 'event: ended\ndata: {"reason":"persona_ended"}\n\n')
      throw new Error('unexpected')
    })
    const backend = new AdhChatBackend({ personaSlug: SLUG, fetchImpl, store })
    const events = await drain(backend, 'bye')

    // The goodbye is ordinary transcript; `ended` becomes a clean close, not a visible event —
    // and the turn still terminates with `done`, which the chat package requires even though the
    // server sent none.
    expect(events).toEqual([{ type: 'token', text: 'goodbye' }, { type: 'done' }])
    // Same recovery as the length cap: the dead id goes, so the visitor's next message
    // transparently opens a new conversation rather than 409ing against this one.
    expect(store.map.has(CONVO_KEY)).toBe(false)
  })

  it('a 409 after termination also starts fresh, and says so rather than citing the length cap', async () => {
    const store = memStore()
    const { fetchImpl } = fakeFetch((call) => {
      if (call.url.endsWith('/visitor-tokens')) return json({ token: 't', expiresAt: FUTURE, personaId: 'p' }, 201)
      if (call.url.endsWith('/persona/bootstrap')) return json({ chat: { limits: { maxConversationLength: 200 } } })
      if (call.url.endsWith('/conversations')) return json({ id: 'over' }, 201)
      // Reached when this client still holds an id the server has since closed — a second tab, or
      // a turn aborted after the persona ended it but before the `ended` block was read.
      if (call.url.endsWith('/turns'))
        return json({ error: { message: 'this conversation has ended; start a new one' } }, 409)
      throw new Error('unexpected')
    })
    const backend = new AdhChatBackend({ personaSlug: SLUG, fetchImpl, store })
    const events = await drain(backend)

    // Telling this visitor they hit a 200-message limit would simply be false.
    const message = (events[0] as { message: string }).message
    expect(message).toContain('conversation has ended')
    expect(message).not.toContain('limit')
    expect(store.map.has(CONVO_KEY)).toBe(false)
  })

  it('maps a 503 turn (kill switch / budget) to the "resting" error', async () => {
    const { fetchImpl } = fakeFetch((call) => {
      if (call.url.endsWith('/visitor-tokens')) return json({ token: 't', expiresAt: FUTURE, personaId: 'p' }, 201)
      if (call.url.endsWith('/persona/bootstrap')) return json({})
      if (call.url.endsWith('/conversations')) return json({ id: 'c' }, 201)
      if (call.url.endsWith('/turns')) return new Response('', { status: 503 })
      throw new Error('unexpected')
    })
    const backend = new AdhChatBackend({ personaSlug: SLUG, fetchImpl, store: memStore() })
    const events = await drain(backend)
    expect(events).toHaveLength(1)
    expect((events[0] as { type: string; message: string }).type).toBe('error')
    expect((events[0] as { message: string }).message).toMatch(/resting/i)
  })

  it('maps a 503 at conversation-create to the "resting" error', async () => {
    const { fetchImpl } = fakeFetch((call) => {
      if (call.url.endsWith('/visitor-tokens')) return json({ token: 't', expiresAt: FUTURE, personaId: 'p' }, 201)
      if (call.url.endsWith('/persona/bootstrap')) return json({})
      if (call.url.endsWith('/conversations')) return new Response('', { status: 503 })
      throw new Error('unexpected')
    })
    const backend = new AdhChatBackend({ personaSlug: SLUG, fetchImpl, store: memStore() })
    const events = await drain(backend)
    expect((events[0] as { message: string }).message).toMatch(/resting/i)
  })
})

describe('AdhChatBackend — SSR safety', () => {
  it('constructs without a store outside the browser and reads as empty', () => {
    // No window in the node test env; the default browserStore must no-op rather than throw.
    const backend = new AdhChatBackend({ personaSlug: SLUG })
    expect(backend).toBeInstanceOf(AdhChatBackend)
  })
})

// Guard: the module-level constants stay in sync with the namespaced key scheme.
describe('key namespacing', () => {
  beforeEach(() => {
    /* no shared state */
  })
  it('derives token/convo keys from the slug', () => {
    expect(TOKEN_KEY).toBe('bitbag.visitor.bitbag.token')
    expect(CONVO_KEY).toBe('bitbag.visitor.bitbag.conversation')
  })
})

// This backend serves EVERY public persona (the registry mounts it on every profile), so the
// visitor-facing failure copy must name the persona it was actually built for. It used to say
// "bitbag" verbatim — the name of one particular persona — on every profile in the registry.
describe('AdhChatBackend — failure copy names the persona', () => {
  /** Fail at conversation-create with `status`, so the copy is produced by the gate path. */
  function failingAt(status: number) {
    return fakeFetch((call) => {
      if (call.url.endsWith('/visitor-tokens')) return json({ token: 't', expiresAt: FUTURE, personaId: 'p' }, 201)
      if (call.url.endsWith('/persona/bootstrap')) return json({})
      if (call.url.endsWith('/conversations')) return new Response('', { status })
      throw new Error('unexpected')
    }).fetchImpl
  }

  it('uses the supplied persona name, not a hardcoded one', async () => {
    const backend = new AdhChatBackend({
      personaSlug: 'olylo',
      personaName: 'Olylo',
      fetchImpl: failingAt(503),
      store: memStore(),
    })
    const [evt] = await drain(backend)
    expect((evt as { message: string }).message).toBe(
      'Olylo is resting right now — please check back in a little while.',
    )
  })

  it('stays generic (never another persona’s name) when none was supplied', async () => {
    const backend = new AdhChatBackend({ personaSlug: 'olylo', fetchImpl: failingAt(500), store: memStore() })
    const [evt] = await drain(backend)
    const message = (evt as { message: string }).message
    expect(message).toBe("This persona couldn't start a chat right now. Please try again in a moment.")
    expect(message.toLowerCase()).not.toContain('bitbag')
  })

  it('prefers the bootstrap name once a turn has read it', async () => {
    // The mint succeeds and bootstrap answers with the real name; the TURN then 503s, so the
    // copy is emitted after bootstrap and must use its name over the constructor's.
    const { fetchImpl } = fakeFetch((call) => {
      if (call.url.endsWith('/visitor-tokens')) return json({ token: 't', expiresAt: FUTURE, personaId: 'p' }, 201)
      if (call.url.endsWith('/persona/bootstrap')) return json({ persona: { name: 'Renamed Persona' } })
      if (call.url.endsWith('/conversations')) return json({ id: 'c' }, 201)
      if (call.url.endsWith('/turns')) return new Response('', { status: 503 })
      throw new Error('unexpected')
    })
    const backend = new AdhChatBackend({
      personaSlug: 'olylo',
      personaName: 'Stale Name',
      fetchImpl,
      store: memStore(),
    })
    const [evt] = await drain(backend)
    expect((evt as { message: string }).message).toMatch(/^Renamed Persona is resting/)
  })
})
