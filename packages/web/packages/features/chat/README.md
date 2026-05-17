# `@agentic-cookbook/agentic-web-toolkit/chat`

A React chat-widget library. This README explains how consumers compose the four orthogonal axes — **layout**, **behavior**, **theme**, and **transport** — to configure a chat for their site.

The toolkit is consumed via git-submodule + `file:` dependency (see the root [`.claude/CLAUDE.md`](../../.claude/CLAUDE.md)). The `exports` map in [`/package.json`](../../package.json) is the public API surface.

---

## Axis 1 — Layout (build-time, by component)

Layout is **not a runtime decision**. Pick a component and import it directly.

| Component | When | Notes |
|---|---|---|
| `<InlineChat>` | Floating widget anchored to a corner of the page | Most common. Pairs with the `.pc-inline` positioning helper. |
| `<ThreePaneChat>` | Topic-list / chat / detail-pane layout | Has its own dynamic-height system; sizing axis below does not apply. |
| `<MobileChat>` | Full-screen overlay | `open` / `onClose` props drive the slide-in. |

`<PersonaChat mode={...}>` is a thin runtime mode-switcher that dispatches to one of the three above. Reach for it only if you genuinely need to flip layouts at runtime — otherwise pick the component directly.

```tsx
import { InlineChat, MockBackend } from '@agentic-cookbook/agentic-web-toolkit/chat'

<InlineChat backend={new MockBackend()} persona={{ name: 'Bot' }} />
```

### View vs. wrapper components

Each layout exposes two flavors:

- `<InlineChat>` (etc.) — the convenience wrapper. Owns its own `useChatSession`. Use when one chat = one session.
- `<InlineChatView>` (etc.) — presentational only. Takes a `session` prop. Use when you want to **lift** a session above the layout (e.g. share state across modes, or persist messages when the user toggles between inline ↔ mobile). The example app does this.

---

## Axis 2 — Behavior (sizing, props on the component)

### Sizing (`InlineChat` only)

`sizing` is a discriminated-union prop. Default is `{ mode: 'fixed' }`, which keeps the existing behavior (chat box gets its size from CSS — see `.pc-inline` below).

```ts
type InlineChatSizing =
  | { mode: 'fixed' }
  | {
      mode: 'content-hugging'
      maxHeight:
        | { kind: 'css'; value: string }                        // '400px' or '60vh'
        | { kind: 'viewport-offset'; topOffsetPx: number }      // top of chat ≥ N px from top of window
        | {
            kind: 'element-offset'
            ref: RefObject<HTMLElement | null>                  // anchor element above the chat
            gapPx?: number                                      // optional spacing
          }
    }
```

**Content-hugging semantics:** the chat box height equals its content. Because the wrapper is bottom-anchored, growth extends the top edge upward — the input bar stays put. Past `maxHeight`, the transcript scrolls (today's behavior).

```tsx
// Cap at a fixed CSS length:
<InlineChat sizing={{ mode: 'content-hugging', maxHeight: { kind: 'css', value: '400px' } }} ... />

// Cap so the chat top stays >= 80px from the top of the viewport:
<InlineChat sizing={{ mode: 'content-hugging', maxHeight: { kind: 'viewport-offset', topOffsetPx: 80 } }} ... />

// Cap so the chat top stays 16px below the bottom of a header element:
const headerRef = useRef<HTMLElement | null>(null)
<header ref={headerRef}>...</header>
<InlineChat sizing={{ mode: 'content-hugging', maxHeight: { kind: 'element-offset', ref: headerRef, gapPx: 16 } }} ... />
```

`ThreePaneChat` and `MobileChat` ignore this axis — they have their own sizing models (split panes / fullscreen overlay).

---

## Axis 3 — Position (consumer's CSS)

The chat components have **no positioning of their own**. Where on the page the widget appears is your CSS / wrapper-div decision.

The toolkit ships positioning helpers as opt-in CSS classes:

- `.pc-inline` — fixed bottom-center floating widget (`position: fixed; bottom: 1rem; left: 50%; transform: translateX(-50%); width: 360px; height: 50vh; max-height: 600px`). Defined in [`css/modes/inline.css`](./css/modes/inline.css).
- `.pc-mobile-overlay` — full-screen slide-in for `<MobileChat>`. Defined in [`css/modes/mobile.css`](./css/modes/mobile.css).
- `.pc-three-pane-frame` — three-column layout for `<ThreePaneChat>`. Defined in [`css/modes/three-pane.css`](./css/modes/three-pane.css).

Consumers opt in by wrapping (or by composing into their own layout):

```tsx
<div className="pc-inline">
  <InlineChat ... />
</div>
```

You can also write your own positioning CSS — the chat doesn't care. If you use `sizing: 'content-hugging'` with a custom positioning class, that class needs to provide a bottom-anchor for the "grows up" effect to read naturally.

---

## Axis 4 — Theme (CSS import)

Themes are stylesheets driven by CSS variables. Import one:

```tsx
import '@agentic-cookbook/agentic-web-toolkit/chat/css/base.css'      // always required
import '@agentic-cookbook/agentic-web-toolkit/chat/css/modes/inline.css'  // for inline mode
import '@agentic-cookbook/agentic-web-toolkit/chat/themes/professional.css'
```

Themes shipped today: `professional`, `techy`, `whimsical`, `agenticcookbookweb`, `dev-team`, `mikefullerton`, `myprojects`, `myprojectsoverview`, `terminal`, `terminal-split`. See [`themes/`](./themes/).

**Themes are mutually exclusive.** Importing two at once produces a last-import-wins style cascade. If you need to switch themes at runtime, do it via dynamic import + remount (the example uses `<style>{themeCss}</style>` swapping for the same effect).

---

## Axis 5 — Display (mobile overlay)

There's no built-in responsive switcher. Two options:

- **Wire it yourself** with `useMediaQuery` and pick `<InlineChat>` vs. `<MobileChat>`.
- **Use `<PersonaChat mode={...}>`** as a runtime switch, driving `mode` from your media query.

A `<ResponsiveChat>` wrapper that bundles this is on the roadmap.

---

## Axis 6 — Transport (LLM hookup)

The chat is **transport-agnostic**. It does not call OpenAI/Anthropic/etc. directly. All comms flow through the `ChatBackend` interface ([`backends/types.ts`](./backends/types.ts)):

```ts
interface ChatBackend {
  sendMessage(text: string, history: ChatMessage[]): Promise<ChatResponse>
  sendMessageStream?(text, history, signal?): AsyncIterable<ChatStreamEvent>
  destroy?(): void
}
```

Shipped implementations:

- `MockBackend` — fake replies for demos.
- `FetchBackend` — POSTs `{ message, history }` to a URL you specify, reads `{ reply: string }` (or anything via `mapResponse`). **Non-streaming only.**

### Expected architecture

```
Browser (your site)                    Your server                     LLM provider
─────────────────────                  ─────────────                   ─────────────
<InlineChat                            POST /api/chat
  backend={fetchBackend}               ↓
/>                                     reads message + history
   │ sendMessage(text, history)        builds system prompt           POST /v1/messages
   ▼                                   calls Anthropic SDK     ────►  with API key
FetchBackend.sendMessage               returns reply           ◄────
   │
   ▼
fetch('/api/chat', { ... })
```

API keys never live in the browser. Your server owns the system prompt, persona, RAG, tools, auth, rate limits, and logging — the toolkit's chat is just a UI shell + transport interface.

### Streaming

`sendMessageStream` is in the interface but **no shipped backend implements it**. If you want token-by-token UI, write your own backend class against an SSE endpoint on your server. A reference `StreamingFetchBackend` is on the roadmap.

### Tool calls

The types support tool-call events (`tool_call_started` / `tool_call_completed`, see `ChatStreamEvent` in [`types.ts`](./types.ts)) and `MessageBubble` renders `ToolCallInfo` if your stream emits them. None of the shipped backends produce these events; they're for consumers building richer streaming integrations.

---

## A complete example

See [`examples/chat`](../../examples/chat) for a runnable demo with all axes wired into a single page (mode toggles, sizing toggles, theme picker, dark/light appearance). Run it with `./examples/chat/run.sh`.
