import type { ChatBackend, ChatMessage, ChatResponse, ChatStreamEvent } from "./chat-types";
import type { ChatStatusKind } from "@agentic-toolkit/data/personas";
/**
 * The payload of the backend's `award` SSE event (src/llm/service.ts's
 * `ChatStreamEvent` union) — badges/XP/level-up earned by the turn that just
 * completed. This is NOT part of the toolkit's {@link ChatStreamEvent} union, so
 * it never flows through `toStreamEvent`; it's routed out-of-band via the
 * `onAward` sink instead, the same way `status` drives `onStatus`.
 */
export interface ChatAward {
    badges: Array<{
        badgeId: string;
        name: string;
        icon: string;
        tier: string;
        description: string;
    }>;
    xpGained: number;
    leveledUpTo: number | null;
}
/**
 * The two auth-aware fetch helpers this backend needs, INJECTED by the consumer.
 * Each app owns its own `@agentic-toolkit/auth/client` import and passes these in, so
 * this shared module does NOT depend on `@agentic-toolkit/auth` — which would close an
 * `adh ↔ auth` workspace cycle (auth already depends on adh) and break clean builds.
 */
export interface AuthedFetchers {
    /** Bearer-attaching fetch → raw Response (used for the SSE stream); this backend
     *  always supplies an init, matching @agentic-toolkit/auth's required-init signature. */
    authedFetch: (path: string, init: RequestInit) => Promise<Response>;
    /** Bearer-attaching fetch → parsed JSON. */
    authedJson: <T>(path: string, init?: RequestInit) => Promise<T>;
}
/**
 * A {@link ChatBackend} that streams a live conversation with one persona via the
 * adh backend. It lazily creates a conversation (pinned to the persona's slug +
 * model) on the first message, then POSTs each turn to the SSE `messages`
 * endpoint and yields the persona's reply token-by-token. The persona's service,
 * model, and prompt all come from its saved config — the backend resolves them
 * from the slug — so the chat reflects exactly what's declared in the persona.
 *
 * Stable per (slug, model): memoize it at the call site so the chat session
 * isn't reset on every render.
 */
export declare class PersonaChatBackend implements ChatBackend {
    private readonly opts;
    private conversationId;
    private controller;
    constructor(opts: AuthedFetchers & {
        personaSlug: string;
        model: string | null;
        /** Optional sink for the persona's current activity kind; null ends the turn. */
        onStatus?: (kind: ChatStatusKind | null) => void;
        /** Optional sink for the `award` SSE event — badges/XP/level-up earned this
         *  turn. Fires at most once per turn, before the terminal `done`. */
        onAward?: (award: ChatAward) => void;
    });
    /** Create the backing conversation once; reuse it for the rest of the session. */
    private ensureConversation;
    /** Non-streaming fallback (the chat package prefers sendMessageStream when present). */
    sendMessage(text: string): Promise<ChatResponse>;
    sendMessageStream(text: string, _history: ChatMessage[], signal?: AbortSignal): AsyncIterable<ChatStreamEvent>;
    /**
     * Drive one turn: ensure a conversation, POST the message, stream the reply.
     * Emits status transitions along the way ("think" on send, "respond" on the
     * first token, "retry" on a backend retry) and always clears the status when
     * the turn ends — normal completion, error, or abort.
     */
    private run;
    destroy(): void;
}
//# sourceMappingURL=index.d.ts.map