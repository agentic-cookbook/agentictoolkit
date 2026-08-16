import type {
  ChatBackend,
  ChatMessage,
  ChatResponse,
  ChatStreamEvent,
} from "./chat-types";
// What the persona is doing, as a KIND rather than a phrase. The words shown for a kind are
// the persona's own — resolved from its `chatStatus` config by the surface that renders the
// chat — so this module no longer holds any user-visible copy. `null` ends the turn.
import type { ChatStatusKind } from "@agentic-toolkit/data/personas";

// Shared persona-chat backend + status vocabulary, consumed by every persona
// chat surface (the persona-registry preview panel and the hub editor pane).
//
// A ChatBackend that streams a live conversation with one persona via the adh
// backend's persona-chat API. It lazily creates a conversation (pinned to the
// persona's slug + model), then POSTs each turn to the SSE `messages` endpoint
// and yields the reply token-by-token. The persona's service, model, and
// assembled system prompt (model prompt + voice + character + examples) all come
// from its SAVED config — the backend resolves them from the slug — so a viewer
// chats with exactly what the persona declares, not an unsaved draft.
//
// Talks through each site's same-origin BFF proxy, which strips the `/api`
// prefix before forwarding (the backend mounts chat at `/chat`). Conversations
// are the backend's persona-chat primitive. See websites/backend/src/routes/chat.ts
// + src/llm/factory.ts. Auth rides on authedFetch/authedJson, which attach the
// signed-in session's bearer token.
const CONVERSATIONS = "/api/chat/conversations";

/**
 * The payload of the backend's `award` SSE event (src/llm/service.ts's
 * `ChatStreamEvent` union) — badges/XP/level-up earned by the turn that just
 * completed. This is NOT part of the toolkit's {@link ChatStreamEvent} union, so
 * it never flows through `toStreamEvent`; it's routed out-of-band via the
 * `onAward` sink instead, the same way `status` drives `onStatus`.
 */
export interface ChatAward {
  badges: Array<{ badgeId: string; name: string; icon: string; tier: string; description: string }>;
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

/** The fields we read off POST /chat/conversations (it returns the full DTO). */
interface CreatedConversation {
  id: string;
}

/** Pull a typed payload out of an SSE `data:` string, tolerating bad JSON. */
function parseData<T>(data: string): T | null {
  try {
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

/**
 * Map one parsed SSE block (its `event:` name + joined `data:` payload) to the
 * chat package's {@link ChatStreamEvent}. The backend's own event vocabulary is
 * identical (token / tool_call_started / tool_call_completed / done / error —
 * see src/llm/service.ts), so this is a near-passthrough; the leading `open`
 * heartbeat and any unknown event are dropped (return null).
 */
function toStreamEvent(event: string, data: string): ChatStreamEvent | null {
  switch (event) {
    case "token":
      return { type: "token", text: parseData<{ text: string }>(data)?.text ?? "" };
    case "tool_call_started": {
      const d = parseData<{ name: string; arguments: string }>(data);
      return d ? { type: "tool_call_started", name: d.name, arguments: d.arguments } : null;
    }
    case "tool_call_completed": {
      const d = parseData<{ name: string; ok: boolean; result: string }>(data);
      return d ? { type: "tool_call_completed", name: d.name, ok: d.ok, result: d.result } : null;
    }
    case "done":
      return { type: "done" };
    case "error":
      return { type: "error", message: parseData<{ message: string }>(data)?.message ?? "Chat failed." };
    default:
      return null;
  }
}

/** Split a single `event:`/`data:` SSE block into its raw event name + payload. */
function parseSseBlock(block: string): { event: string; data: string } {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""));
    // `:` comment lines and `id:`/`retry:` are ignored.
  }
  return { event, data: dataLines.join("\n") };
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
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
export class PersonaChatBackend implements ChatBackend {
  private conversationId: string | null = null;
  private controller: AbortController | null = null;

  constructor(
    private readonly opts: AuthedFetchers & {
      personaSlug: string;
      model: string | null;
      /** Optional sink for the persona's current activity kind; null ends the turn. */
      onStatus?: (kind: ChatStatusKind | null) => void;
      /** Optional sink for the `award` SSE event — badges/XP/level-up earned this
       *  turn. Fires at most once per turn, before the terminal `done`. */
      onAward?: (award: ChatAward) => void;
    },
  ) {}

  /** Create the backing conversation once; reuse it for the rest of the session. */
  private async ensureConversation(): Promise<string> {
    if (this.conversationId) return this.conversationId;
    const convo = await this.opts.authedJson<CreatedConversation>(CONVERSATIONS, {
      method: "POST",
      body: JSON.stringify({
        personaSlug: this.opts.personaSlug,
        // The backend resolves model as persona.model || conversation.model;
        // pass the persona's configured model so an unset persona.model still works.
        model: this.opts.model ?? undefined,
      }),
    });
    this.conversationId = convo.id;
    return convo.id;
  }

  /** Non-streaming fallback (the chat package prefers sendMessageStream when present). */
  async sendMessage(text: string): Promise<ChatResponse> {
    let out = "";
    for await (const evt of this.run(text)) {
      if (evt.type === "token") out += evt.text;
      else if (evt.type === "error") throw new Error(evt.message);
    }
    return out;
  }

  sendMessageStream(
    text: string,
    _history: ChatMessage[],
    signal?: AbortSignal,
  ): AsyncIterable<ChatStreamEvent> {
    return this.run(text, signal);
  }

  /**
   * Drive one turn: ensure a conversation, POST the message, stream the reply.
   * Emits status transitions along the way ("think" on send, "respond" on the
   * first token, "retry" on a backend retry) and always clears the status when
   * the turn ends — normal completion, error, or abort.
   */
  private async *run(text: string, signal?: AbortSignal): AsyncGenerator<ChatStreamEvent> {
    try {
      this.opts.onStatus?.("think");

      let id: string;
      try {
        id = await this.ensureConversation();
      } catch (err) {
        yield { type: "error", message: errorMessage(err, "Couldn't start the conversation.") };
        return;
      }

      this.controller = new AbortController();
      // Route cancellation through our OWN controller so destroy() is always
      // authoritative, and forward any caller-supplied signal into it — so both a
      // caller abort AND destroy() cancel the in-flight SSE request. (Binding the
      // fetch straight to an external signal left destroy() unable to cancel.)
      if (signal) {
        if (signal.aborted) this.controller.abort();
        else signal.addEventListener("abort", () => this.controller?.abort(), { once: true });
      }
      let res: Response;
      try {
        res = await this.opts.authedFetch(`${CONVERSATIONS}/${id}/messages`, {
          method: "POST",
          headers: { Accept: "text/event-stream" },
          body: JSON.stringify({ message: text }),
          signal: this.controller.signal,
        });
      } catch (err) {
        yield { type: "error", message: errorMessage(err, "The chat request failed.") };
        return;
      }

      const body = res.body;
      if (!body) {
        yield { type: "error", message: "No response stream from the chat backend." };
        return;
      }

      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let responded = false;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let sep: number;
          while ((sep = buffer.indexOf("\n\n")) !== -1) {
            const { event, data } = parseSseBlock(buffer.slice(0, sep));
            buffer = buffer.slice(sep + 2);
            // `status` is an out-of-band signal (a retry) — it drives the status
            // line, it is NOT a transcript event, so consume it and move on.
            if (event === "status") {
              if (parseData<{ phase?: string }>(data)?.phase === "retrying") {
                this.opts.onStatus?.("retry");
              }
              continue;
            }
            // `award` is out-of-band the same way `status` is: it's not part of the
            // toolkit's ChatStreamEvent union, so route it straight to onAward and
            // never hand it to toStreamEvent (which would just drop it as unknown).
            if (event === "award") {
              const award = parseData<ChatAward>(data);
              if (award) this.opts.onAward?.(award);
              continue;
            }
            const evt = toStreamEvent(event, data);
            if (!evt) continue;
            if (evt.type === "token" && !responded) {
              responded = true;
              this.opts.onStatus?.("respond");
            }
            yield evt;
          }
        }
      } finally {
        reader.releaseLock();
      }
    } finally {
      this.opts.onStatus?.(null);
    }
  }

  destroy(): void {
    this.controller?.abort();
  }
}
