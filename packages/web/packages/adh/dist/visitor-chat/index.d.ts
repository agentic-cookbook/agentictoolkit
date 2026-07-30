import type { ChatBackend, ChatMessage, ChatResponse, ChatStreamEvent } from '../persona-chat/chat-types';
/** A minimal key/value store — the seam that makes the token lifecycle testable. */
export interface KeyValueStore {
    get(key: string): string | null;
    set(key: string, value: string): void;
    remove(key: string): void;
}
/** The bootstrap payload fields the UI may care about (persona name + advisory caps). */
export interface BootstrapInfo {
    personaName: string;
    /** Advisory copy of the server-enforced per-conversation message cap (null if unset). */
    maxConversationLength: number | null;
}
export interface AdhChatBackendOptions {
    /** The PUBLIC persona slug to mint a visitor token against (e.g. 'bitbag'). */
    personaSlug: string;
    /**
     * Same-origin API base; defaults to '/api' — the site's BFF proxy prefix, which
     * strips `/api` before forwarding to the backend root (see next.config.ts).
     */
    apiBase?: string;
    /** Injected fetch (defaults to the global) — present so tests can drive the wire. */
    fetchImpl?: typeof fetch;
    /** Injected store (defaults to an SSR-safe localStorage wrapper) — for tests. */
    store?: KeyValueStore;
    /**
     * How to NAME the persona in the visitor-facing failure copy ("… is resting right now").
     * Optional because the bootstrap read supplies the authoritative name — but the gates that
     * produce these messages are exactly the ones that fail BEFORE (or instead of) bootstrap, so
     * a caller that already knows the name should pass it. Absent, the copy stays generic rather
     * than naming the wrong persona.
     */
    personaName?: string;
    /** Optional sink for the bootstrap payload, so the UI can show name/limits. */
    onBootstrap?: (info: BootstrapInfo) => void;
}
export declare class AdhChatBackend implements ChatBackend {
    private readonly slug;
    private readonly apiBase;
    private readonly fetchImpl;
    private readonly store;
    private readonly givenName?;
    private readonly onBootstrap?;
    private controller;
    private bootstrap;
    /** The name the bootstrap ACTUALLY carried, kept apart from `bootstrap.personaName` (which
     *  falls back to the slug for its UI consumers) — a raw slug reads like a typo in a sentence. */
    private bootstrapName;
    private bootstrapDone;
    constructor(opts: AdhChatBackendOptions);
    /** The name to put in visitor-facing copy: the bootstrap's (authoritative, but only once a
     *  turn has got that far), else the caller's, else neutral. The gates that produce this copy
     *  are mostly the ones that fail before bootstrap, hence the constructor option. */
    private get personaName();
    /** The stored token, or null when absent/expired (so the caller re-mints). */
    private readStoredToken;
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
    private mintToken;
    private ensureToken;
    /** Fetch an authed endpoint with the visitor bearer, transparently re-minting the
     *  token once on a 401 (expired/revoked) and retrying the SAME request. The re-mint restarts the
     *  whole anonymous session, conversation included (see {@link mintToken}) — so a 401 on ANY authed
     *  request, the bootstrap read included, correctly abandons the old conversation: it belongs to the
     *  dead token and no request under the new one could ever reach it. */
    private authedFetch;
    /** Read GET /persona/bootstrap once (best-effort). Surfaces the persona's name +
     *  advisory limits; a failure never blocks chatting. */
    private ensureBootstrap;
    /** Reuse the stored conversation (a returning visitor resumes), else create one. */
    private ensureConversation;
    private turnFetch;
    /** POST the turn, self-healing a stale conversation once:
     *  - 401 → the token is gone; re-mint (which drops the orphaned conversation id),
     *    re-create the conversation under the new token, and retry.
     *  - 404 → the token is still valid but the stored conversation no longer exists
     *    server-side (its retention window elapsed and the reaper deleted it, so the
     *    turn pre-flight 404s). Drop only the dead id, create a fresh conversation, and
     *    retry — otherwise the visitor is stranded forever POSTing to a deleted id. */
    private postTurn;
    /** Drive one turn: ensure a token + bootstrap, POST the turn, gate on its HTTP
     *  status, then stream the reply as ChatStreamEvents. */
    private run;
    /** Map a gate/network failure to a friendly error event. */
    private gateErrorEvent;
    /** Non-streaming fallback — the chat package prefers sendMessageStream when present. */
    sendMessage(text: string, _history: ChatMessage[]): Promise<ChatResponse>;
    sendMessageStream(text: string, _history: ChatMessage[], signal?: AbortSignal): AsyncIterable<ChatStreamEvent>;
    destroy(): void;
}
//# sourceMappingURL=index.d.ts.map