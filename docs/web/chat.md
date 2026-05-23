# Chat

`@agentic-toolkit/chat` is a React 19 + TypeScript chat library with four
display modes, a typed backend contract, and CSS-only theming.

This doc covers usage, the message-layout spec, and chat-specific theming.
For wiring the broader toolkit (`ColorModeProvider`, `ThemeStyle`, Tailwind
v4, Next.js config) see [`next-js-consumer.md`](next-js-consumer.md).

---

## Component hierarchy

```
PersonaChat (convenience wrapper — delegates via mode prop)
├── InlineChat          — simple chat, popovers render inline
├── ThreePaneChat       — chat + detail pane + topics sidebar + connector SVGs
│   ├── DetailPane
│   ├── TopicsPane
│   └── ConnectorSVG
└── MobileChat          — full-screen slide-in overlay

ContentOverlay          — generic overlay shell (any content); MobileChat is the chat-specialized variant

Shared internals:
├── Transcript          — message list + typing indicator
├── MessageBubble       — single message (text, time, rich content)
├── ChatInput           — input field + send button
├── InlinePopover       — collapsible popover (inline mode only)
├── RichContent         — links/images inside bubbles
├── TypingIndicator     — animated dots
└── useChatSession      — hook: messages state, send queue, typing state
```

---

## Quick start

```tsx
'use client'
import { InlineChat, MockBackend } from '@agentic-toolkit/chat'
import '@agentic-toolkit/chat/css/base.css'
import '@agentic-toolkit/chat/css/modes/inline.css'
import '@agentic-toolkit/themes/styles/professional.css'

const backend = new MockBackend()

export function ChatExample() {
  return (
    <div className="persona-chat">
      <InlineChat
        backend={backend}
        persona={{ name: 'Ada', avatar: 'A' }}
        welcomeMessage="Hello! How can I help?"
      />
    </div>
  )
}
```

Three CSS layers, imported in order:

1. `@agentic-toolkit/chat/css/base.css` — structural layout, required.
2. `@agentic-toolkit/chat/css/modes/<mode>.css` — positioning per mode.
3. `@agentic-toolkit/themes/styles/<theme>.css` — visual theme (defines
   both site-wide `--color-*` and chat-specific `--pc-*` tokens).

In a Next.js consumer with `ColorModeProvider` + `ThemeStyle` wired
([`next-js-consumer.md`](next-js-consumer.md)), the theme CSS is injected by
`ThemeStyle` — you only need the chat layers (base + mode).

---

## Components

### `InlineChat`

Simple centered chat. Popovers render inline with toggle arrows.

```tsx
<InlineChat
  backend={backend}
  persona={{ name: 'Ada', avatar: 'A' }}
  user={{ name: 'You', avatar: 'Y' }}    // optional
  welcomeMessage="Hello!"                  // optional
  className="my-class"                     // optional
/>
```

### `ThreePaneChat`

Chat pane + detail pane + topics sidebar with SVG connector lines.

```tsx
import { ThreePaneChat } from '@agentic-toolkit/chat'
import '@agentic-toolkit/chat/css/modes/three-pane.css'

<ThreePaneChat
  backend={backend}
  persona={{ name: 'Ada' }}
  welcomeMessage="Try: small panel, big panel"
/>
```

Detail and topics panes fade in when popover data arrives. SVG connectors
read anchor positions via `ResizeObserver`/`MutationObserver` and draw
between registered `<ConnectorAnchor>` markers.

### `MobileChat`

Full-screen slide-in overlay for mobile layouts. Auto-focuses the input
~350ms after opening (triggers the iOS keyboard).

```tsx
import { MobileChat } from '@agentic-toolkit/chat'
import '@agentic-toolkit/chat/css/modes/mobile.css'

<MobileChat
  backend={backend}
  persona={{ name: 'Ada' }}
  open={chatOpen}
  onClose={() => setChatOpen(false)}
  closeLabel="← back"               // optional, default: "← back"
/>
```

### `ContentOverlay`

Generic overlay shell — `MobileChat` is the chat-specialized variant.
`ContentOverlay` wraps arbitrary content (not just a chat) in the same
slide-in shell. Use it when you want the mobile-overlay treatment without
forcing the content to be a chat.

```tsx
import { ContentOverlay } from '@agentic-toolkit/chat'
import '@agentic-toolkit/chat/css/components/content-overlay.css'

<ContentOverlay open={open} onClose={close}>{anyReactNode}</ContentOverlay>
```

### `PersonaChat`

Convenience wrapper — delegates to `InlineChat`, `ThreePaneChat`, or
`MobileChat` via a `mode` prop.

```tsx
<PersonaChat mode="inline" backend={backend} persona={{ name: 'Ada' }} />
```

---

## Backends

### `ChatBackend` interface

```typescript
interface ChatBackend {
  sendMessage(text: string, history: ChatMessage[]): Promise<ChatResponse>
  destroy?(): void
}

type ChatResponse = string | {
  text: string
  content?: ContentItem[]    // links, images
  popover?: PopoverData      // title, description, links
}
```

History is passed to `sendMessage()` so backends can implement context
windows or stay stateless.

### `MockBackend`

Canned responses for development and testing.

```tsx
const backend = new MockBackend({
  delayMs: [400, 1200],  // random delay range
  responses: {
    'custom': 'Custom response',
    'dynamic': () => `Random: ${Math.random()}`,
  },
})
```

Built-in commands: `hello`, `text`, `small panel`, `big panel`,
`small image`, `big image`, `links`.

### `FetchBackend`

HTTP POST backend for real services.

```tsx
const backend = new FetchBackend({
  url: '/api/chat',
  headers: { Authorization: 'Bearer ...' },      // optional
  mapResponse: (data) => data.reply,              // optional
})
```

Sends `{ message, history }` as JSON. Supports `AbortController` cleanup
via `destroy()`.

---

## Send queue

Messages are queued and processed sequentially via `useChatSession`. The
input never disables — users can type quickly without waiting for
responses.

---

## `useChatSession` (advanced)

Core state-management hook used internally by every mode component.
Available for custom layouts.

```tsx
import { useChatSession } from '@agentic-toolkit/chat'

const {
  messages,
  isTyping,
  sendMessage,
  selectedIndex,
  selectMessage,
} = useChatSession({
  backend,
  persona: { name: 'Ada' },
  welcomeMessage: 'Hello!',
})
```

---

## Message layout

### Mental model

Each message entry is a full-width row in the transcript:

```
[gutter] [bubble content] [gutter]
```

- Every entry row spans the **full width** of the transcript.
- The **bubble** within the row hugs its content; the row does not.
- Persona messages: bubble is left-aligned.
- User messages: bubble is right-aligned.

All left edges and all right edges of entry rows are aligned — only the
bubble width varies.

### Content (bubble)

- **Short content** (fits on one line): the bubble hugs the content width.
- **Wrapping content**: the bubble fills up to `max-width` before wrapping.

Vertical height is precious. Every entry is as short as possible — the
timestamp shares a line with content whenever it fits.

### Timestamp

Always in the **lower-right** of the bubble. Uses `float: right` so it
shares a line with whatever content precedes it when there's room.

Shares a line whenever:

- Content fits on one line with the timestamp.
- Content wraps and the last wrapped line + timestamp fit comfortably.
- Rich content (links/images) is present and the last item + timestamp fit.

Gets its own line **only** when the last line of content truly fills the
width.

When rich content (`.pc-content`) exists, the time element is moved inside
it so `float: right` works relative to the last content item.

### Visual reference

```
Short message (persona, left-aligned):
┌──────────────────────────────────────────────────────────────────────┐
│  Hello!                                                    10:04 AM │
└──────────────────────────────────────────────────────────────────────┘

Medium message (content + time fit on last line):
┌──────────────────────────────────────────────────────────────────────┐
│  Here are some things I can show you.                      10:04 AM │
└──────────────────────────────────────────────────────────────────────┘

Long message (time on its own line):
┌──────────────────────────────────────────────────────────────────────┐
│  This is a much longer message that wraps to fill the               │
│  entire content column before breaking to the next line.            │
│                                                            10:04 AM │
└──────────────────────────────────────────────────────────────────────┘

Long message (last line + time fit):
┌──────────────────────────────────────────────────────────────────────┐
│  This is a much longer message that wraps to fill the               │
│  entire content column. Last line is short.                10:04 AM │
└──────────────────────────────────────────────────────────────────────┘

Rich content (time shares line with last link):
┌──────────────────────────────────────────────────────────────────────┐
│  Here are some things I can show you:                               │
│  Documentation                                                      │
│  API Reference                                             10:04 AM │
└──────────────────────────────────────────────────────────────────────┘

User message (right-aligned):
┌──────────────────────────────────────────────────────────────────────┐
│                      What's the build watch path?          10:05 AM │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Theming

Chat components have no knowledge of themes — all visual styling comes
from CSS. The chat package ships `base.css` (structural) and per-mode CSS;
themes live in [`@agentic-toolkit/themes`](next-js-consumer.md) and
define both site-wide and chat tokens in a single file.

### CSS variables (chat tokens)

Themes set these on `.persona-chat`:

| Property | Description |
|----------|-------------|
| `--pc-gutter` | Transcript padding and bubble max-width offset (default `16px`) |
| `--pc-persona-bg` | Persona bubble background (color or gradient) |
| `--pc-persona-text` | Persona bubble text color |
| `--pc-persona-name` | Persona sender name color |
| `--pc-user-bg` | User bubble background |
| `--pc-user-text` | User bubble text color |
| `--pc-user-name` | User sender name color |
| `--pc-surface` | Pane / widget background |
| `--pc-input-bg` | Input field background |
| `--pc-input-border` | Input field border color |
| `--pc-input-focus` | Input field border color when focused |
| `--pc-send-bg` | Send button background |
| `--pc-send-text` | Send button icon color |
| `--pc-time-color` | Timestamp color |
| `--pc-radius` | Bubble border-radius |
| `--pc-font` | Primary font family |

All classes are prefixed with `pc-` to avoid collisions with the consuming
page.

### Quick recolor

To override a few properties without writing a full theme, override them
after the theme import:

```css
.persona-chat {
  --pc-persona-bg: #7c3aed;
  --pc-send-bg: #7c3aed;
}
```

### Built-in themes

Ten themes ship in `@agentic-toolkit/themes/styles/`:

| Theme | Style |
|-------|-------|
| `mikefullerton` | Editorial, cinematic, gold |
| `agenticcookbookweb` | Warm, glassmorphism |
| `dev-team` | Minimal, technical |
| `myprojects` | Dashboard, stat-driven |
| `myprojectsoverview` | Analytical, monospace |
| `terminal` | Retro IRC, no bubbles |
| `terminal-split` | IRC, user right-aligned |
| `techy` | Dark, terminal-inspired |
| `professional` | Clean, trustworthy (Inter + JetBrains Mono) |
| `whimsical` | Warm, playful, gradients (Nunito) |

Each theme file `@import`s its Google Fonts directly — you don't need
separate font links in your `<head>`.

### Creating a custom theme

Copy any file under `packages/themes/src/styles/` and modify it. All
theme selectors are scoped to `.persona-chat` (for chat tokens) or `:root`
(for site tokens), so they won't leak.

### DOM structure

```
div.persona-chat
  div.pc-transcript
    div.pc-message.pc-persona  (or .pc-user)
      div.pc-bubble
        span.pc-text
        span.pc-time
      div.pc-popover           (inline mode only)
  div.pc-input-area
    input.pc-input
    button.pc-send-btn
      svg (paper plane icon)
```

### Animation

Each theme defines its own message entry animation. Common patterns:

- **Pop in** (whimsical): scale + translate with spring easing
- **Fade in** (techy): fast opacity + small translate
- **Slide up** (professional): subtle translate with ease-out

Define `@keyframes` and apply to `.persona-chat .pc-message`.

---

## Tests

```bash
pnpm --filter @agentic-toolkit/chat test
```

Tests live in `packages/features/chat/src/__tests__/` and cover MockBackend,
FetchBackend, useChatSession, MessageBubble, Transcript, InlineChat,
MobileChat, and ThreePaneChat.

---

## See also

- [`next-js-consumer.md`](next-js-consumer.md) — wiring `ColorModeProvider`,
  `ThemeStyle`, Tailwind v4, and the chat layers in a Next.js 15 app.
- [`monorepo-conversion.md`](monorepo-conversion.md) — how the chat
  package fits into the broader toolkit and the rationale for the current
  shape.
