import type {
  ChatBackend,
  ChatMessage,
  ChatResponse,
  ChatStreamEvent,
} from '../persona-chat/chat-types'
import { parseData, readSseBlocks, toStreamEvent } from './sse'

// A ChatBackend that streams a live conversation with a PUBLIC persona (bitbag)
// via the adh backend's unauthenticated visitor-chat path. It:
//   (a) mints a short-lived visitor token (localStorage), re-minting on expiry/401;
//   (b) reads GET /persona/bootstrap once for the persona's name + advisory limits;
//   (c) lazily creates one visitor conversation (id kept in localStorage) so a
//       returning visitor with a still-valid token resumes it;
//   (d) POSTs each turn to the SSE turn route, mapping its events to ChatStreamEvents.
// See docs/platform/{visitor-auth,persona-bootstrap}.md. All persona authority is
// exercised server-side inside the turn loop; the visitor only ever holds this token.

/** A minimal key/value store — the seam that makes the token lifecycle testable. */
export interface KeyValueStore {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

/** The bootstrap payload fields the UI may care about (persona name + advisory caps). */
export interface BootstrapInfo {
  personaName: string
  /** Advisory copy of the server-enforced per-conversation message cap (null if unset). */
  maxConversationLength: number | null
}

export interface AdhChatBackendOptions {
  /** The PUBLIC persona slug to mint a visitor token against (e.g. 'bitbag'). */
  personaSlug: string
  /**
   * Same-origin API base; defaults to '/api' — the site's BFF proxy prefix, which
   * strips `/api` before forwarding to the backend root (see next.config.ts).
   */
  apiBase?: string
  /** Injected fetch (defaults to the global) — present so tests can drive the wire. */
  fetchImpl?: typeof fetch
  /** Injected store (defaults to an SSR-safe localStorage wrapper) — for tests. */
  store?: KeyValueStore
  /**
   * How to NAME the persona in the visitor-facing failure copy ("… is resting right now").
   * Optional because the bootstrap read supplies the authoritative name — but the gates that
   * produce these messages are exactly the ones that fail BEFORE (or instead of) bootstrap, so
   * a caller that already knows the name should pass it. Absent, the copy stays generic rather
   * than naming the wrong persona.
   */
  personaName?: string
  /** Optional sink for the bootstrap payload, so the UI can show name/limits. */
  onBootstrap?: (info: BootstrapInfo) => void
}

/** The persisted visitor-token record (the mint response, minus what we don't keep). */
interface StoredToken {
  token: string
  expiresAt: string | null
  personaId: string
}

/** Treat a token expiring within this window as already expired, so a turn never
 *  starts on a token that lapses mid-flight. */
const EXPIRY_SKEW_MS = 30_000

const tokenKey = (slug: string): string => `bitbag.visitor.${slug}.token`
const convoKey = (slug: string): string => `bitbag.visitor.${slug}.conversation`

// The visitor-facing failure copy. This backend serves ANY public persona — the registry
// mounts it for every profile — so the persona is named at call time rather than baked in;
// hardcoding 'bitbag' here told a visitor on someone else's profile that a persona they had
// never heard of was resting. `DEFAULT_PERSONA_NAME` keeps the sentences grammatical when no
// name is known yet (the gates below can fail before the bootstrap read lands).
const DEFAULT_PERSONA_NAME = 'This persona'
const restingMessage = (who: string): string =>
  `${who} is resting right now — please check back in a little while.`
const startFailedMessage = (who: string): string =>
  `${who} couldn't start a chat right now. Please try again in a moment.`
const unavailableMessage = (who: string): string => `${who} isn't available right now.`
const lengthCapMessage = (max: number | null): string =>
  max != null
    ? `This chat has reached its ${max}-message limit. Send another message to start a fresh conversation.`
    : 'This chat has reached its length limit. Send another message to start a fresh conversation.'

/** A non-2xx from the mint / create-conversation gates, carrying the HTTP status
 *  so the caller can map 503 → resting, 404 → unavailable, etc. */
class VisitorGateError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'VisitorGateError'
  }
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}

/** SSR-safe localStorage wrapper: a no-op when there's no window (server render) or
 *  when access throws (private mode / storage disabled), so construction and reads
 *  never crash outside the browser. */
function browserStore(): KeyValueStore {
  const ls = (): Storage | null => {
    try {
      return typeof window !== 'undefined' ? window.localStorage : null
    } catch {
      return null
    }
  }
  return {
    get: (k) => {
      try {
        return ls()?.getItem(k) ?? null
      } catch {
        return null
      }
    },
    set: (k, v) => {
      try {
        ls()?.setItem(k, v)
      } catch {
        /* ignore quota / denied */
      }
    },
    remove: (k) => {
      try {
        ls()?.removeItem(k)
      } catch {
        /* ignore */
      }
    },
  }
}

export class AdhChatBackend implements ChatBackend {
  private readonly slug: string
  private readonly apiBase: string
  private readonly fetchImpl: typeof fetch
  private readonly store: KeyValueStore
  private readonly givenName?: string
  private readonly onBootstrap?: (info: BootstrapInfo) => void

  private controller: AbortController | null = null
  private bootstrap: BootstrapInfo | null = null
  /** The name the bootstrap ACTUALLY carried, kept apart from `bootstrap.personaName` (which
   *  falls back to the slug for its UI consumers) — a raw slug reads like a typo in a sentence. */
  private bootstrapName: string | null = null
  private bootstrapDone = false

  constructor(opts: AdhChatBackendOptions) {
    this.slug = opts.personaSlug
    this.apiBase = (opts.apiBase ?? '/api').replace(/\/+$/, '')
    this.fetchImpl = opts.fetchImpl ?? ((input, init) => fetch(input, init))
    this.store = opts.store ?? browserStore()
    this.givenName = opts.personaName
    this.onBootstrap = opts.onBootstrap
  }

  /** The name to put in visitor-facing copy: the bootstrap's (authoritative, but only once a
   *  turn has got that far), else the caller's, else neutral. The gates that produce this copy
   *  are mostly the ones that fail before bootstrap, hence the constructor option. */
  private get personaName(): string {
    return this.bootstrapName ?? this.givenName ?? DEFAULT_PERSONA_NAME
  }

  // --- token lifecycle -----------------------------------------------------

  /** The stored token, or null when absent/expired (so the caller re-mints). */
  private readStoredToken(): StoredToken | null {
    const rec = parseData<StoredToken>(this.store.get(tokenKey(this.slug)) ?? '')
    if (!rec || !rec.token) return null
    if (rec.expiresAt) {
      const exp = Date.parse(rec.expiresAt)
      if (!Number.isNaN(exp) && exp - EXPIRY_SKEW_MS <= Date.now()) return null
    }
    return rec
  }

  /** Mint a fresh visitor token, persist it, and drop any conversation the OLD token owned.
   *
   *  Dropping the id is REQUIRED here, not merely tidy, and it is NOT in tension with the
   *  conversation's own much longer retention window. Server-side a visitor conversation is owned by
   *  the TOKEN ROW that created it (`createVisitorConversation` stamps `visitor_token_id = auth.id`)
   *  and every read is scoped to that id (`getVisitorConversation` filters on it), so the turn route
   *  404s any conversation a DIFFERENT token owns. Each mint inserts a brand-new token row with a new
   *  id — nothing reuses or re-parents one — so a re-mint makes the stored conversation permanently
   *  unreachable however much of its 30-day TTL remains. Keeping the id would buy only a guaranteed
   *  404 on the next turn. See backend routes/visitor.ts + llm/persistence.ts. */
  private async mintToken(): Promise<StoredToken> {
    const res = await this.fetchImpl(
      `${this.apiBase}/public/personas/${encodeURIComponent(this.slug)}/visitor-tokens`,
      { method: 'POST', headers: { Accept: 'application/json' } },
    )
    if (!res.ok) throw new VisitorGateError(`mint failed (${res.status})`, res.status)
    const body = parseData<StoredToken>(await res.text())
    if (!body || !body.token) throw new VisitorGateError('mint returned no token', res.status)
    const rec: StoredToken = {
      token: body.token,
      expiresAt: body.expiresAt ?? null,
      personaId: body.personaId,
    }
    this.store.set(tokenKey(this.slug), JSON.stringify(rec))
    this.store.remove(convoKey(this.slug))
    return rec
  }

  private async ensureToken(): Promise<StoredToken> {
    return this.readStoredToken() ?? (await this.mintToken())
  }

  /** Fetch an authed endpoint with the visitor bearer, transparently re-minting the
   *  token once on a 401 (expired/revoked) and retrying the SAME request. The re-mint restarts the
   *  whole anonymous session, conversation included (see {@link mintToken}) — so a 401 on ANY authed
   *  request, the bootstrap read included, correctly abandons the old conversation: it belongs to the
   *  dead token and no request under the new one could ever reach it. */
  private async authedFetch(path: string, init: RequestInit): Promise<Response> {
    const withAuth = (token: string): RequestInit => ({
      ...init,
      headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${token}` },
    })
    const rec = await this.ensureToken()
    const res = await this.fetchImpl(`${this.apiBase}${path}`, withAuth(rec.token))
    if (res.status !== 401) return res
    const fresh = await this.mintToken()
    return this.fetchImpl(`${this.apiBase}${path}`, withAuth(fresh.token))
  }

  // --- bootstrap -----------------------------------------------------------

  /** Read GET /persona/bootstrap once (best-effort). Surfaces the persona's name +
   *  advisory limits; a failure never blocks chatting. */
  private async ensureBootstrap(): Promise<void> {
    if (this.bootstrapDone) return
    try {
      const res = await this.authedFetch('/persona/bootstrap', { headers: { Accept: 'application/json' } })
      // Transient/gate failure — leave UNLATCHED so a later turn retries rather than pinning the
      // persona name to the raw slug (and the length copy to the generic fallback) for the whole
      // session after one blip. A later turn re-attempts; the latch only trips on a real success.
      if (!res.ok) return
      const payload = parseData<{
        persona?: { name?: string }
        chat?: { limits?: { maxConversationLength?: number } }
      }>(await res.text())
      if (!payload) return
      const name = payload.persona?.name?.trim()
      this.bootstrapName = name ? name : null
      this.bootstrap = {
        personaName: name ? name : this.slug,
        maxConversationLength: payload.chat?.limits?.maxConversationLength ?? null,
      }
      this.onBootstrap?.(this.bootstrap)
      this.bootstrapDone = true // latch only after a definitive success
    } catch {
      /* advisory network error — leave unlatched to retry on a later turn */
    }
  }

  // --- conversation --------------------------------------------------------

  /** Reuse the stored conversation (a returning visitor resumes), else create one. */
  private async ensureConversation(): Promise<string> {
    const existing = this.store.get(convoKey(this.slug))
    if (existing) return existing
    const res = await this.authedFetch('/public/visitor-chat/conversations', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: '{}',
    })
    if (res.status === 503) throw new VisitorGateError('resting', 503)
    if (!res.ok) throw new VisitorGateError(`create conversation failed (${res.status})`, res.status)
    const body = parseData<{ id: string }>(await res.text())
    if (!body || !body.id) throw new VisitorGateError('create conversation returned no id', res.status)
    this.store.set(convoKey(this.slug), body.id)
    return body.id
  }

  // --- turn ----------------------------------------------------------------

  private turnFetch(id: string, token: string, body: string, signal: AbortSignal): Promise<Response> {
    return this.fetchImpl(
      `${this.apiBase}/public/visitor-chat/conversations/${encodeURIComponent(id)}/turns`,
      {
        method: 'POST',
        headers: {
          Accept: 'text/event-stream',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body,
        signal,
      },
    )
  }

  /** POST the turn, self-healing a stale conversation once:
   *  - 401 → the token is gone; re-mint (which drops the orphaned conversation id),
   *    re-create the conversation under the new token, and retry.
   *  - 404 → the token is still valid but the stored conversation no longer exists
   *    server-side (its retention window elapsed and the reaper deleted it, so the
   *    turn pre-flight 404s). Drop only the dead id, create a fresh conversation, and
   *    retry — otherwise the visitor is stranded forever POSTing to a deleted id. */
  private async postTurn(text: string, signal: AbortSignal): Promise<Response> {
    const body = JSON.stringify({ message: text })
    const id = await this.ensureConversation()
    const rec = await this.ensureToken()
    const res = await this.turnFetch(id, rec.token, body, signal)
    if (res.status === 401) {
      const fresh = await this.mintToken() // drops the orphaned conversation id
      const newId = await this.ensureConversation() // fresh conversation under the new token
      return this.turnFetch(newId, fresh.token, body, signal)
    }
    if (res.status === 404) {
      this.store.remove(convoKey(this.slug))
      const newId = await this.ensureConversation() // fresh conversation, same token
      return this.turnFetch(newId, rec.token, body, signal)
    }
    return res
  }

  /** Drive one turn: ensure a token + bootstrap, POST the turn, gate on its HTTP
   *  status, then stream the reply as ChatStreamEvents. */
  private async *run(text: string, signal?: AbortSignal): AsyncGenerator<ChatStreamEvent> {
    try {
      await this.ensureToken()
    } catch (err) {
      yield this.gateErrorEvent(err)
      return
    }
    await this.ensureBootstrap()

    // Own the AbortController so destroy() is always authoritative; forward the
    // caller's signal into it so both a caller abort AND destroy() cancel the turn.
    const controller = new AbortController()
    this.controller = controller
    if (signal) {
      if (signal.aborted) controller.abort()
      else signal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    // Clear our controller reference on EVERY exit path (normal completion, early return, abort, or
    // the generator being closed), but only if it is still THIS turn's controller — so a later turn
    // that overwrote it isn't clobbered. Without this, this.controller kept pointing at a finished
    // turn and destroy() could target the wrong (or an already-done) controller.
    try {
      let res: Response
      try {
        res = await this.postTurn(text, controller.signal)
      } catch (err) {
        if (isAbortError(err)) return
        yield this.gateErrorEvent(err)
        return
      }

      // The server's fail-closed gates answer with a plain status, NOT an SSE body,
      // so branch on the status before reading the stream.
      if (res.status === 409) {
        // Length cap: drop the maxed-out conversation so the next message starts fresh.
        this.store.remove(convoKey(this.slug))
        yield { type: 'error', message: lengthCapMessage(this.bootstrap?.maxConversationLength ?? null) }
        return
      }
      if (res.status === 503) {
        yield { type: 'error', message: restingMessage(this.personaName) }
        return
      }
      if (!res.ok || !res.body) {
        yield { type: 'error', message: startFailedMessage(this.personaName) }
        return
      }

      try {
        for await (const { event, data } of readSseBlocks(res.body)) {
          // `open` heartbeat + out-of-band `status`/`award` map to null (dropped).
          const evt = toStreamEvent(event, data)
          if (evt) yield evt
        }
      } catch (err) {
        if (isAbortError(err)) return
        yield { type: 'error', message: errorMessage(err, 'The chat stream failed.') }
      }
    } finally {
      if (this.controller === controller) this.controller = null
    }
  }

  /** Map a gate/network failure to a friendly error event. */
  private gateErrorEvent(err: unknown): ChatStreamEvent {
    if (err instanceof VisitorGateError) {
      if (err.status === 503) return { type: 'error', message: restingMessage(this.personaName) }
      if (err.status === 404) return { type: 'error', message: unavailableMessage(this.personaName) }
    }
    return { type: 'error', message: startFailedMessage(this.personaName) }
  }

  // --- ChatBackend ---------------------------------------------------------

  /** Non-streaming fallback — the chat package prefers sendMessageStream when present. */
  async sendMessage(text: string, _history: ChatMessage[]): Promise<ChatResponse> {
    let out = ''
    for await (const evt of this.run(text)) {
      if (evt.type === 'token') out += evt.text
      else if (evt.type === 'error') throw new Error(evt.message)
    }
    return out
  }

  sendMessageStream(
    text: string,
    _history: ChatMessage[],
    signal?: AbortSignal,
  ): AsyncIterable<ChatStreamEvent> {
    return this.run(text, signal)
  }

  destroy(): void {
    this.controller?.abort()
  }
}
