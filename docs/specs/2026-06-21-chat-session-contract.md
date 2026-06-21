# Chat Session Contract — Design

- **Date:** 2026-06-21
- **Status:** Approved design, pre-implementation
- **Scope of this spec:** Phase 1 (the contract + Local + Mock + streaming UI) in detail; Phases 2–4 sketched.
- **Home:** AgenticToolkit (the contract is consumed by BitBag, AgenticToolkitApp, Whippet, Stenographer).

## 1. Problem & goals

The toolkit's chat UI is wired to its engine through `ChatBackend`
(`macOS/Features/AIChatWindow/ChatBackend.swift`). Three problems make it unfit
as the durable, reusable contract we want going forward:

1. **Streaming never reaches the UI.** `ChatViewModel.runTurn` accumulates the
   whole reply into a local `turnText` and appends one `ChatMessage` only after
   the stream closes. Even providers that stream token-by-token (ClaudeAPI SSE,
   `claude -p` stdout) render as a single late blob.
2. **One error kills the conversation.** `ChatBackend.sendMessages` returns an
   `AsyncThrowingStream`, so the first transient failure (rate limit, a flaky
   `claude -p` exit, a dropped SSE frame) terminates the stream with no
   in-session recovery.
3. **The contract leaks transport.** Backend specifics (plugins, models, API
   keys) and a duplicate, older path (`WhippetChatBackend`, blocking + non-
   streaming) fragment the wiring. There is no single, testable seam.

**Goals:** a contract that is **durable** (stable surface; backend churn stays
out of it), **performant** (true token streaming without per-token full
re-layout), and **reusable** (one protocol, many implementations, shared across
products). The backend already does server-side streaming chat with personas,
memory, and tools (`POST /chat/conversations/:id/messages`, SSE), so the local
plugin path is demoted to one implementation among several, not the center.

**Non-goals for Phase 1:** the ADH remote implementation, JWT sign-in, the warm
persistent `claude` session, daemon caching, and persona/memory/KB surfacing.
All are designed-for here but built in later phases.

## 2. The contract

A single protocol, `ChatSession`, is the wire between the UI and any chat
engine. It is a **headless engine** (no AppKit/SwiftUI, off the main actor); the
UI's observable state is built by folding its event stream (§4). The only shared
surface is this protocol plus a handful of Foundation-only value types, all in
**`AgenticToolkitCore`**.

```swift
public protocol ChatSession: Sendable {
    /// One long-lived stream of everything the UI reacts to. Subscribe once.
    /// Non-throwing: a failed turn is an in-band event (`turnFailed`), so a
    /// transient error never tears down the session. The stream ends only
    /// after `close()`.
    func events() -> AsyncStream<ChatEvent>

    /// Send a user turn. Returns immediately; effects arrive as events.
    func send(_ text: String)

    /// Interrupt the in-flight assistant response. No-op if none is running.
    func interrupt()

    /// Tear down: terminate the subprocess / drop the connection. Ends `events()`.
    func close()
}

public enum ChatEvent: Sendable {
    case stateChanged(ChatSessionState)
    case transcriptLoaded([ChatMessage])                       // bulk initial history (remote resume)
    case userMessage(ChatMessage)                              // canonical echo of an accepted turn
    case responseStarted(messageID: ChatMessage.ID)
    case responseDelta(messageID: ChatMessage.ID, text: String)
    case toolCall(messageID: ChatMessage.ID, name: String, phase: ToolPhase)
    case responseFinished(messageID: ChatMessage.ID, stopReason: String?)
    case turnFailed(ChatError)                                 // recoverable; session stays alive
}

public enum ToolPhase: Sendable { case started, completed }

public enum ChatSessionState: Sendable {
    case connecting          // opened, not yet ready (remote handshake/auth)
    case ready               // idle, accepting input
    case responding          // a turn is in flight
    case failed(ChatError)   // fatal: cannot continue without intervention
    case closed
}

public struct ChatError: Error, Sendable, Equatable {
    public let message: String      // user-facing
    public let isRetryable: Bool
    public init(message: String, isRetryable: Bool) {
        self.message = message
        self.isRetryable = isRetryable
    }
}
```

The transcript element type is the existing `ChatMessage`, **moved to
`AgenticToolkitCore`** and extended so deltas can mutate text in place and the
view can show a streaming caret:

```swift
public struct ChatMessage: Identifiable, Equatable, Sendable {
    public let id: String                 // ChatMessage.ID == String
    public let role: Role
    public var text: String               // var: responseDelta appends in place
    public var isStreaming: Bool          // true between responseStarted and responseFinished
    public let timestamp: Date

    public enum Role: Sendable, Equatable { case user, assistant, error }

    /// Explicit-id init so the UI can create the placeholder bubble that
    /// `responseStarted(messageID:)` names, then grow it on each delta.
    public init(id: String = UUID().uuidString, role: Role, text: String,
                isStreaming: Bool = false, timestamp: Date = Date())
}
```

### Rationale (the three load-bearing choices)

1. **`messageID` on every response event.** `responseStarted` makes the UI
   create an empty assistant bubble with that id; each `responseDelta` appends
   to it. That is the entire streaming fix, identical for local, mock, and
   remote.
2. **Non-throwing event stream.** Errors are `turnFailed` events (with a
   user-facing message and `isRetryable`), not stream termination. The session
   survives a bad turn and the user can retry. Only `close()` ends `events()`.
   Truly fatal conditions surface as `stateChanged(.failed)`.
3. **The contract names no backend.** No models, plugins, keys, conversation
   IDs, personas, or auth appear here — those are constructor arguments of each
   concrete type. This is the firewall against future change: when the remote
   implementation lands and teaches us something, the churn is in
   `RemoteChatSession`'s init/config, not in this protocol. The most this
   surface should need is one additional `ChatEvent` case, which local and mock
   ignore.

## 3. Implementations & placement

| Piece | Module | Notes |
|---|---|---|
| `ChatSession`, `ChatEvent`, `ChatMessage`, `ChatSessionState`, `ChatError`, `ToolPhase` | `AgenticToolkitCore` (Foundation-only) | The durable contract. No UI, plugins, or network. |
| `MockChatSession` | `AgenticToolkitCore` | Pure; powers unit tests *and* SwiftUI/AppKit previews. (Splittable into `AgenticToolkitCoreTestSupport` later if shipping a mock in Core becomes undesirable.) |
| `LocalChatSession` | `AgenticToolkitMacOS` / Features/AIPlugins | Replaces `AIPluginChatBackend` in place. Reuses `plugin.buildRequest` + `PluginTransport.run`, mapping `AIStreamEvent` → `ChatEvent`. Reads `PluginConfigStore` directly. |
| `RemoteChatSession` (stub now) | near `AgenticDeveloperHubClient` (the existing backend-client layer that owns `DaemonContract`) | Phase 1 ships a stub that conforms and emits `stateChanged(.failed(ChatError(message: "Remote chat coming soon", isRetryable: false)))`, so the coordinator can select it and everything compiles. Real impl is Phase 2. |

**Opener seam:** `AIChatCoordinator(makeSession: () -> any ChatSession)` (evolved
from today's `makeBackend`). The factory is **synchronous**; a freshly opened
session starts in `.connecting` and transitions via events. Local/mock emit
`.ready` immediately; remote emits `.connecting → .ready` after its handshake.
This keeps the coordinator uniform and avoids an async/throwing opener only one
implementation needs.

**`MockChatSession` shape:**

```swift
public final class MockChatSession: ChatSession {
    public init(script: MockScript)       // declarative steps: .delay, .emit(ChatEvent), .stream(text, chunk:, every:)
    public static func streaming(_ text: String, chunk: Int = 3,
                                 every: Duration = .milliseconds(40)) -> MockChatSession
    public static func echo() -> MockChatSession
    public static func canned(_ events: [ChatEvent]) -> MockChatSession
}
```

On `send(text)` the mock echoes a `userMessage`, then plays its next scripted
response (deltas with timing, optional tool calls, optional `turnFailed`).

**Phase-1 `LocalChatSession` stays spawn-per-turn** — same `claude -p`
lifecycle as today — but its bytes now flow through as `responseDelta` events so
streaming is visible. The warm persistent process is Phase 3: same type,
internal change, contract untouched.

## 4. UI consumption

`ChatViewModel` stops being an engine and becomes a thin **event-folding
adapter** whose only logic is a pure reducer `(messages, event) → messages`:

```swift
@MainActor
final class ChatViewModel: ObservableObject {
    @Published private(set) var messages: [ChatMessage] = []
    @Published private(set) var state: ChatSessionState = .connecting   // replaces isTyping
    var isResponding: Bool { if case .responding = state { true } else { false } }

    private let session: any ChatSession
    private var pump: Task<Void, Never>?

    init(session: any ChatSession) {
        self.session = session
        pump = Task { [weak self] in
            for await event in session.events() { self?.apply(event) }   // on MainActor
        }
    }

    func send(_ text: String) { session.send(text) }
    func interrupt() { session.interrupt() }

    private func apply(_ event: ChatEvent) {            // the entire testable core
        switch event {
        case .stateChanged(let s):           state = s
        case .transcriptLoaded(let history): messages = history
        case .userMessage(let m):            messages.append(m)
        case .responseStarted(let id):       messages.append(ChatMessage(id: id, role: .assistant, text: "", isStreaming: true))
        case .responseDelta(let id, let t):  mutate(id) { $0.text += t }
        case .toolCall:                      break   // Phase 1: minimal inline marker (§4); richer tool UI in Phase 2
        case .responseFinished(let id, _):   mutate(id) { $0.isStreaming = false }
        case .turnFailed(let err):           messages.append(ChatMessage(role: .error, text: err.message))
        }
    }
    // mutate(_ id:_:) finds the message by id and applies the change; unknown ids are ignored.
}
```

Tool rendering in Phase 1 is minimal (a short inline marker on the in-flight
message); richer tool UI comes with the remote phase that actually exercises it.

**Performance (you asked for performant).** Today `ChatView.rebuildTranscript()`
tears down and rebuilds the entire stack on every `messages` change — at token
rates that is many full rebuilds per second. Two targeted changes:

1. **Coalesce deltas** — apply `responseDelta` mutations on a per-runloop /
   display-link tick (~30–60 fps) rather than once per token.
2. **In-flight fast path** — when only the last bubble's text changed, update
   that one `MessageBubbleView`'s text + remeasure instead of a full rebuild.
   Reserve full rebuild for structural changes (new message, tool marker,
   resize — which already triggers it).

## 5. Migration & deletions

Converge to one contract; delete the duplicates (design-for-deletion).

- `ChatBackend` + `ChatStreamEvent` + `ChatBackendMessage`
  (`macOS/Features/AIChatWindow/ChatBackend.swift`,
  `Core/AIPlugins/ChatStreamEvent.swift`) → **deleted**, replaced by
  `ChatSession` + `ChatEvent` + the canonical `ChatMessage`.
  - `ChatBackend.isReady` / `isReadyChanges()` fold into `ChatSessionState` /
    `stateChanged`.
  - The `[ChatBackendMessage]`-per-send history model is dropped; the session
    owns history. The plugin layer keeps its own rich, tool-aware
    `AIChatMessage` (AIPluginKit); `LocalChatSession` translates
    `ChatMessage` → `AIChatMessage` when building `AIChatContext`. That is a
    real layer boundary, not duplication.
- `AIPluginChatBackend` → becomes `LocalChatSession`.
- `WhippetChatBackend` (older blocking, non-streaming, parallel path) →
  **deleted**; Whippet switches to `LocalChatSession`. Unifies the two chat
  code paths.
- `PluginChatConfigProvider` / `SinglePluginChatConfigProvider` → their
  `PluginConfigStore` reads fold into `LocalChatSession`'s init; the protocol
  indirection collapses. `PluginConfigStore` itself stays.
- `AIChatCoordinator.makeBackend` → `makeSession`.

**Blast radius:** shared-toolkit surgery. AgenticToolkitApp, Whippet,
Stenographer, and BitBag all consume it, but nearly all touch chat only through
`AIChatCoordinator(makeSession:)`, so per-app changes are confined to the
factory closure each passes. Each consumer is migrated as part of the work, not
left broken.

## 6. Testing

Three tiers, all powered by the contract:

1. **Reducer unit tests** (headless, no AppKit): feed `apply` a scripted
   `[ChatEvent]`, assert resulting `messages`/`state`. Covers: delta targets the
   right bubble; unknown/out-of-order ids ignored safely; `turnFailed` leaves
   the transcript intact and adds an error message; `transcriptLoaded` replaces.
   Pure and instant.
2. **`MockChatSession`-driven UI tests**: script a multi-delta streamed reply
   with delays + a tool call + a mid-turn retryable error + an interrupt; assert
   the view shows progressive text, the responding/idle states, and the error
   affordance. This is the "mock to test the chat UI" requirement.
3. **Previews/demos**: `MockChatSession.streaming(...)` powers SwiftUI/AppKit
   previews so chat UI (and later, themes) iterate with zero backend.

## 7. Phase map

Each phase is independently shippable and sits behind the stable contract;
later phases add implementations and features, never a UI/contract rewrite.

- **Phase 1 — Contract + Local + Mock + streaming UI (this spec).** Define the
  contract + value types in Core; `MockChatSession`; `LocalChatSession`
  (spawn-per-turn, truly streaming); `ChatViewModel` reducer rewrite +
  `ChatView` streaming fast-path; `AIChatCoordinator(makeSession:)`; migrate all
  consumers and delete `ChatBackend`/`WhippetChatBackend`; reducer + mock tests.
  *Outcome:* visibly streaming, fully testable chat with zero backend
  dependency.
- **Phase 2 — ADH remote session.** `RemoteChatSession` over the backend SSE;
  conversation create/resume/list; JWT sign-in with token in Keychain wired to
  `.connecting`/`.failed`; reconnect/backoff; interrupt closes the stream. Pulls
  in sign-in + conversation/persona selection UI. *Outcome:* real backend chat
  with personas, server-side memory, and tools. Most likely phase to teach a
  contract tweak — absorbed safely thanks to the mock + proven reducer.
- **Phase 3 — Warm local session.** Upgrade `LocalChatSession` to a persistent
  `claude --input-format stream-json --output-format stream-json` process —
  cold-start paid once on open, only the new turn sent. Internal change behind
  the contract. *Outcome:* kills first-response latency.
- **Phase 4 — Daemon cache + personas/memory/knowledge bases.** Daemon caches
  *non-chat* user data (personas, memory, profile) on `127.0.0.1:22850`; chat
  stream stays app→backend direct (revisitable). Surface persona pick, memory
  recall/inspect, and KB — **the KB backend API does not exist yet** (frontend
  shell only), so it is gated on backend work. *Outcome:* the full ADH
  experience.

## 8. Change-tolerance notes (the explicit caveat)

The stateful-session shape was chosen knowing it "may change once we wire up
real backend chats." The design contains that risk deliberately:

- The shared surface is small (`ChatSession` + one event enum + four value
  types). Everything backend-specific lives in concrete implementations.
- `MockChatSession` + the pure reducer mean the UI is testable and stable
  independent of any real backend, so Phase 2's discoveries can reshape
  `RemoteChatSession` (and, if needed, add a `ChatEvent` case) without breaking
  local, mock, or the view.
- If Phase 2 reveals the session should expose conversation identity or
  history-loading affordances beyond `transcriptLoaded`, those are additive and
  reviewed at that time.
