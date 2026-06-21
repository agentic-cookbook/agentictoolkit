# Chat Session Contract — Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a durable `ChatSession` contract (a headless, streaming chat engine protocol) with two implementations — `LocalChatSession` (plugin-backed) and `MockChatSession` (test/preview) — make the chat UI render token-by-token by folding the session's event stream, and migrate BitBag onto it while keeping all other consumers compiling via a legacy bridge.

**Architecture:** `ChatSession` (Foundation-only, in `AgenticToolkitCore`) exposes `events() -> AsyncStream<ChatEvent>` + `send`/`interrupt`/`close`. A pure `ChatTranscriptReducer` folds events into `[ChatMessage]`. `ChatViewModel` becomes a thin `@MainActor` adapter that pumps the stream through the reducer. `LocalChatSession` owns one turn end-to-end (build `AIChatContext` → drive an injected event-stream factory, default `PluginTransport.run` → emit `ChatEvent`s), preserving the existing MCP tool loop behind an injectable `ChatToolSource`. `AIChatCoordinator` gains a `makeSession` initializer; the existing `makeBackend` path is preserved by wrapping any legacy `ChatBackend` in a `ChatBackendSession` adapter, so AgenticToolkitApp / Whippet stay green untouched.

**Tech Stack:** Swift 6 strict concurrency, AppKit, swift-testing (`import Testing`), XcodeGen (`cc-xcgen`), `AIPluginKit` + `PluginTransport`.

**Scope note (what this plan is NOT):** No ADH remote session, no JWT auth, no warm persistent `claude` process, no daemon caching. `ChatBackend` / `AIPluginChatBackend` / `WhippetChatBackend` are **kept (deprecated), not deleted** — they ride the bridge until AgenticToolkitApp & Whippet are migrated in a follow-up plan. Those migrations + the deletions are explicitly out of scope here.

**Standing conventions for every commit in this plan:**
- Commit messages end with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- Stage only files this plan touches — never `git add -A`/`.`/`-a`.
- After adding/removing/moving any `.swift` file under a target's source glob, run `cc-xcgen packages/apple/AgenticToolkit` before building.
- Build/test env (run from the toolkit repo root `external/agentictoolkit`):
  ```bash
  DD=~/Library/Developer/Xcode/DerivedData/AgenticToolkit-managed
  WS=packages/apple/AgenticToolkit.xcworkspace
  DEST='platform=macOS,arch=arm64'
  ```

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `Core/Chat/ChatMessage.swift` | Create (moved from `macOS/Features/AIChatWindow/ChatMessage.swift`) | Transcript element; `var text`/`isStreaming`, explicit-id init, `Sendable`. |
| `Core/Chat/ChatSession.swift` | Create | The `ChatSession` protocol. |
| `Core/Chat/ChatEvent.swift` | Create | `ChatEvent` + `ToolPhase`. |
| `Core/Chat/ChatSessionState.swift` | Create | `ChatSessionState` + `ChatError`. |
| `Core/Chat/ChatTranscriptReducer.swift` | Create | Pure `(event, &messages, &state)` fold. |
| `Core/Chat/ChatToolSource.swift` | Create | Optional tool provider seam for engines. |
| `Core/Chat/MockChatSession.swift` | Create | Scripted session for tests + previews. |
| `macOS/Features/AIPlugins/LocalChatSession.swift` | Create | Plugin-backed engine; one-turn streaming + tool loop. |
| `macOS/Features/AIPlugins/MCPChatToolSource.swift` | Create | MCP-registry-backed `ChatToolSource` (ports the loop helpers out of the old ViewModel). |
| `macOS/Features/AIChatWindow/ChatBackendSession.swift` | Create | Adapter: legacy `ChatBackend` → `ChatSession`. |
| `macOS/Features/AIChatWindow/ChatViewModel.swift` | Rewrite | Thin `@MainActor` reducer-pump over a `ChatSession`. |
| `macOS/Features/AIChatWindow/AIChatCoordinator.swift` | Modify | Add `init(makeSession:)`; keep `init(makeBackend:)` via the adapter. |
| `macOS/Features/AIChatWindow/ChatView.swift` | Modify | In-place delta growth + coalesced rebuild; bind `state`. |
| `Tests/AgenticToolkitCoreTests/Chat/*` | Create | Reducer + mock tests. |
| `Tests/AgenticToolkitMacOSTests/Chat/*` | Create | `LocalChatSession` + `ChatViewModel` tests. |
| `apple/Bitbag/Bitbag/Sources/AppServices.swift` (BitBag repo) | Modify | `makeSession { LocalChatSession(...) }`. |
| `macOS/Features/.../PluginConfigPanel.swift` | Modify | Preview chat uses `ChatViewModel(session:)`. |

---

## Task 1: Move & extend `ChatMessage` into Core

**Files:**
- Create: `packages/apple/AgenticToolkit/Core/Chat/ChatMessage.swift`
- Delete: `packages/apple/AgenticToolkit/macOS/Features/AIChatWindow/ChatMessage.swift`

- [ ] **Step 1: Create the new file**

```swift
// Core/Chat/ChatMessage.swift
import Foundation

/// A single message in a chat transcript. `text` is mutable so streaming
/// deltas grow the in-flight assistant message in place; `isStreaming` is true
/// between `responseStarted` and `responseFinished` so the view can show a caret.
public struct ChatMessage: Identifiable, Equatable, Sendable {
    public let id: String
    public let role: Role
    public var text: String
    public var isStreaming: Bool
    public let timestamp: Date

    public enum Role: Sendable, Equatable {
        case user
        case assistant
        case error
    }

    public init(
        id: String = UUID().uuidString,
        role: Role,
        text: String,
        isStreaming: Bool = false,
        timestamp: Date = Date()
    ) {
        self.id = id
        self.role = role
        self.text = text
        self.isStreaming = isStreaming
        self.timestamp = timestamp
    }
}
```

- [ ] **Step 2: Delete the old file**

Run: `git rm packages/apple/AgenticToolkit/macOS/Features/AIChatWindow/ChatMessage.swift`

- [ ] **Step 3: Regenerate & build**

```bash
cc-xcgen packages/apple/AgenticToolkit
xcodebuild -workspace "$WS" -scheme AgenticToolkitMacOS -destination "$DEST" -derivedDataPath "$DD" build 2>&1 | tail -20
```
Expected: BUILD SUCCEEDED. (`ChatMessage` is used by `ChatView`/`ChatViewModel` in the macOS module; it now resolves from Core, which the macOS target already depends on. The `id` default changed from `let id = UUID().uuidString` to a parameter — no call site passed `id`, so existing `ChatMessage(role:text:)` calls still compile.)

- [ ] **Step 4: Commit**

```bash
git add packages/apple/AgenticToolkit/Core/Chat/ChatMessage.swift \
        packages/apple/AgenticToolkit/macOS/Features/AIChatWindow/ChatMessage.swift \
        packages/apple/AgenticToolkit/AgenticToolkit.xcodeproj
git commit -m "refactor: move ChatMessage to Core/Chat with mutable streaming fields

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Add the contract types

**Files:**
- Create: `Core/Chat/ChatSessionState.swift`, `Core/Chat/ChatEvent.swift`, `Core/Chat/ChatSession.swift`

- [ ] **Step 1: `ChatSessionState.swift`**

```swift
// Core/Chat/ChatSessionState.swift
import Foundation

/// A user-facing failure. `isRetryable` tells the UI whether offering a retry
/// makes sense (rate limit / transient) vs. not (misconfiguration).
public struct ChatError: Error, Sendable, Equatable {
    public let message: String
    public let isRetryable: Bool
    public init(message: String, isRetryable: Bool) {
        self.message = message
        self.isRetryable = isRetryable
    }
}

/// Lifecycle of a chat session. Drives input-enable + spinner in the UI.
public enum ChatSessionState: Sendable, Equatable {
    case connecting          // opened, not yet ready (remote handshake/auth)
    case ready               // idle, accepting input
    case responding          // a turn is in flight
    case failed(ChatError)   // fatal: cannot continue without intervention
    case closed
}
```

- [ ] **Step 2: `ChatEvent.swift`**

```swift
// Core/Chat/ChatEvent.swift
import Foundation

public enum ToolPhase: Sendable, Equatable { case started, completed }

/// Everything a `ChatSession` tells the UI. Non-throwing by design: a failed
/// turn is `turnFailed`, not stream termination, so the session survives it.
public enum ChatEvent: Sendable, Equatable {
    case stateChanged(ChatSessionState)
    case transcriptLoaded([ChatMessage])
    case userMessage(ChatMessage)
    case responseStarted(messageID: ChatMessage.ID)
    case responseDelta(messageID: ChatMessage.ID, text: String)
    case toolCall(messageID: ChatMessage.ID, name: String, phase: ToolPhase)
    case responseFinished(messageID: ChatMessage.ID, stopReason: String?)
    case turnFailed(ChatError)
}
```

- [ ] **Step 3: `ChatSession.swift`**

```swift
// Core/Chat/ChatSession.swift
import Foundation

/// The wire between a chat UI and any chat engine. Headless and transport-
/// agnostic: implementations may spawn a subprocess, replay a script, or hold a
/// remote SSE connection. The UI builds its observable state by folding
/// `events()` (see `ChatTranscriptReducer`).
public protocol ChatSession: Sendable {
    /// One long-lived stream of everything the UI reacts to. Subscribe once.
    /// Ends only after `close()`.
    func events() -> AsyncStream<ChatEvent>

    /// Send a user turn. Returns immediately; effects arrive as events.
    func send(_ text: String)

    /// Interrupt the in-flight assistant response. No-op if none is running.
    func interrupt()

    /// Tear down: terminate the subprocess / drop the connection. Ends `events()`.
    func close()
}
```

- [ ] **Step 4: Regenerate & build**

```bash
cc-xcgen packages/apple/AgenticToolkit
xcodebuild -workspace "$WS" -scheme AgenticToolkitMacOS -destination "$DEST" -derivedDataPath "$DD" build 2>&1 | tail -20
```
Expected: BUILD SUCCEEDED.

- [ ] **Step 5: Commit**

```bash
git add packages/apple/AgenticToolkit/Core/Chat/ChatSessionState.swift \
        packages/apple/AgenticToolkit/Core/Chat/ChatEvent.swift \
        packages/apple/AgenticToolkit/Core/Chat/ChatSession.swift \
        packages/apple/AgenticToolkit/AgenticToolkit.xcodeproj
git commit -m "feat: add ChatSession contract (ChatSession, ChatEvent, ChatSessionState)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: The pure transcript reducer (TDD)

**Files:**
- Create: `Core/Chat/ChatTranscriptReducer.swift`
- Test: `Tests/AgenticToolkitCoreTests/Chat/ChatTranscriptReducerTests.swift`

- [ ] **Step 1: Write the failing test**

```swift
// Tests/AgenticToolkitCoreTests/Chat/ChatTranscriptReducerTests.swift
import Testing
import Foundation
@testable import AgenticToolkitCore

@Suite("ChatTranscriptReducer")
struct ChatTranscriptReducerTests {

    private func fold(_ events: [ChatEvent]) -> (messages: [ChatMessage], state: ChatSessionState) {
        var messages: [ChatMessage] = []
        var state: ChatSessionState = .connecting
        for e in events { ChatTranscriptReducer.apply(e, to: &messages, state: &state) }
        return (messages, state)
    }

    @Test("deltas grow the bubble named by responseStarted")
    func deltasGrowNamedBubble() {
        let (messages, _) = fold([
            .userMessage(ChatMessage(role: .user, text: "hi")),
            .responseStarted(messageID: "a"),
            .responseDelta(messageID: "a", text: "Hel"),
            .responseDelta(messageID: "a", text: "lo"),
            .responseFinished(messageID: "a", stopReason: nil)
        ])
        #expect(messages.count == 2)
        #expect(messages[1].id == "a")
        #expect(messages[1].text == "Hello")
        #expect(messages[1].isStreaming == false)
        #expect(messages[1].role == .assistant)
    }

    @Test("delta for an unknown id is ignored, not crashing")
    func unknownIdIgnored() {
        let (messages, _) = fold([.responseDelta(messageID: "ghost", text: "x")])
        #expect(messages.isEmpty)
    }

    @Test("turnFailed appends an error message and leaves transcript intact")
    func turnFailedAppendsError() {
        let (messages, _) = fold([
            .userMessage(ChatMessage(role: .user, text: "hi")),
            .turnFailed(ChatError(message: "boom", isRetryable: true))
        ])
        #expect(messages.count == 2)
        #expect(messages[1].role == .error)
        #expect(messages[1].text == "boom")
    }

    @Test("transcriptLoaded replaces the whole transcript")
    func transcriptLoadedReplaces() {
        let (messages, _) = fold([
            .userMessage(ChatMessage(role: .user, text: "stale")),
            .transcriptLoaded([ChatMessage(role: .assistant, text: "restored")])
        ])
        #expect(messages.count == 1)
        #expect(messages[0].text == "restored")
    }

    @Test("stateChanged updates state")
    func stateChangedUpdates() {
        let (_, state) = fold([.stateChanged(.ready)])
        #expect(state == .ready)
    }
}
```

- [ ] **Step 2: Run it; verify it fails to compile (`ChatTranscriptReducer` undefined)**

```bash
xcodebuild -workspace "$WS" -scheme AgenticToolkitMacOS -destination "$DEST" -derivedDataPath "$DD" -only-testing AgenticToolkitCoreTests test 2>&1 | tail -20
```
Expected: build failure — `cannot find 'ChatTranscriptReducer' in scope`.

- [ ] **Step 3: Implement the reducer**

```swift
// Core/Chat/ChatTranscriptReducer.swift
import Foundation

/// Pure fold of a `ChatEvent` into transcript + session state. No UI, no actor —
/// this is the entire testable core of how the chat UI reacts to a session.
public enum ChatTranscriptReducer {

    public static func apply(
        _ event: ChatEvent,
        to messages: inout [ChatMessage],
        state: inout ChatSessionState
    ) {
        switch event {
        case .stateChanged(let s):
            state = s

        case .transcriptLoaded(let history):
            messages = history

        case .userMessage(let message):
            messages.append(message)

        case .responseStarted(let id):
            messages.append(ChatMessage(id: id, role: .assistant, text: "", isStreaming: true))

        case .responseDelta(let id, let text):
            mutate(id, in: &messages) { $0.text += text }

        case .toolCall:
            // Phase 1: no inline tool rendering. The event is retained in the
            // contract for the remote phase that exercises it.
            break

        case .responseFinished(let id, _):
            mutate(id, in: &messages) { $0.isStreaming = false }

        case .turnFailed(let error):
            messages.append(ChatMessage(role: .error, text: error.message))
        }
    }

    private static func mutate(
        _ id: ChatMessage.ID,
        in messages: inout [ChatMessage],
        _ change: (inout ChatMessage) -> Void
    ) {
        guard let index = messages.firstIndex(where: { $0.id == id }) else { return }
        change(&messages[index])
    }
}
```

- [ ] **Step 4: Run tests; verify pass**

```bash
xcodebuild -workspace "$WS" -scheme AgenticToolkitMacOS -destination "$DEST" -derivedDataPath "$DD" -only-testing AgenticToolkitCoreTests test 2>&1 | tail -20
```
Expected: all `ChatTranscriptReducer` tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/apple/AgenticToolkit/Core/Chat/ChatTranscriptReducer.swift \
        packages/apple/AgenticToolkit/Tests/AgenticToolkitCoreTests/Chat/ChatTranscriptReducerTests.swift \
        packages/apple/AgenticToolkit/AgenticToolkit.xcodeproj
git commit -m "feat: pure ChatTranscriptReducer + tests

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `MockChatSession` (TDD)

**Files:**
- Create: `Core/Chat/MockChatSession.swift`
- Test: `Tests/AgenticToolkitCoreTests/Chat/MockChatSessionTests.swift`

- [ ] **Step 1: Write the failing test**

```swift
// Tests/AgenticToolkitCoreTests/Chat/MockChatSessionTests.swift
import Testing
import Foundation
@testable import AgenticToolkitCore

@Suite("MockChatSession")
struct MockChatSessionTests {

    @Test("emits ready on subscribe, then echoes a user turn and streams a reply")
    func streamsScriptedReply() async {
        let session = MockChatSession(reply: "Hi there", chunkSize: 3)
        var received: [ChatEvent] = []

        let collector = Task {
            for await event in session.events() {
                received.append(event)
                if case .responseFinished = event { break }
            }
        }
        // give the subscription a tick to seed .ready
        try? await Task.sleep(for: .milliseconds(20))
        session.send("hello")
        await collector.value
        session.close()

        #expect(received.first == .stateChanged(.ready))
        #expect(received.contains { if case .userMessage(let m) = $0 { return m.text == "hello" } else { return false } })
        let deltas = received.compactMap { event -> String? in
            if case .responseDelta(_, let t) = event { return t } else { return nil }
        }
        #expect(deltas.joined() == "Hi there")
        #expect(received.contains { if case .responseStarted = $0 { return true } else { return false } })
        #expect(received.last.map { if case .responseFinished = $0 { return true } else { return false } } == true)
    }
}
```

- [ ] **Step 2: Run; verify fail (`MockChatSession` undefined)**

```bash
xcodebuild -workspace "$WS" -scheme AgenticToolkitMacOS -destination "$DEST" -derivedDataPath "$DD" -only-testing AgenticToolkitCoreTests test 2>&1 | tail -20
```
Expected: `cannot find 'MockChatSession' in scope`.

- [ ] **Step 3: Implement**

```swift
// Core/Chat/MockChatSession.swift
import Foundation

/// A scripted `ChatSession` for tests, previews, and demos. On `send`, it echoes
/// the user turn, then streams a canned reply in fixed-size chunks. No network,
/// no subprocess.
public final class MockChatSession: ChatSession, @unchecked Sendable {

    private let reply: String
    private let chunkSize: Int
    private let interChunkDelay: Duration

    private let lock = NSLock()
    private var continuation: AsyncStream<ChatEvent>.Continuation?
    private var liveTurn: Task<Void, Never>?

    public init(reply: String = "This is a mock reply.",
                chunkSize: Int = 3,
                interChunkDelay: Duration = .milliseconds(10)) {
        self.reply = reply
        self.chunkSize = chunkSize
        self.interChunkDelay = interChunkDelay
    }

    public func events() -> AsyncStream<ChatEvent> {
        AsyncStream { continuation in
            lock.lock()
            self.continuation = continuation
            lock.unlock()
            continuation.yield(.stateChanged(.ready))
            continuation.onTermination = { [weak self] _ in self?.liveTurn?.cancel() }
        }
    }

    public func send(_ text: String) {
        let cont = withLock { continuation }
        guard let cont else { return }
        cont.yield(.userMessage(ChatMessage(role: .user, text: text)))
        cont.yield(.stateChanged(.responding))

        let assistantID = UUID().uuidString
        let chunks = Self.chunk(reply, size: chunkSize)
        liveTurn = Task { [interChunkDelay] in
            cont.yield(.responseStarted(messageID: assistantID))
            for chunk in chunks {
                if Task.isCancelled { break }
                cont.yield(.responseDelta(messageID: assistantID, text: chunk))
                try? await Task.sleep(for: interChunkDelay)
            }
            cont.yield(.responseFinished(messageID: assistantID, stopReason: "end_turn"))
            cont.yield(.stateChanged(.ready))
        }
    }

    public func interrupt() { liveTurn?.cancel() }

    public func close() {
        liveTurn?.cancel()
        withLock { continuation }?.finish()
    }

    private static func chunk(_ s: String, size: Int) -> [String] {
        guard size > 0 else { return [s] }
        return stride(from: 0, to: s.count, by: size).map {
            let start = s.index(s.startIndex, offsetBy: $0)
            let end = s.index(start, offsetBy: size, limitedBy: s.endIndex) ?? s.endIndex
            return String(s[start..<end])
        }
    }

    private func withLock<T>(_ body: () -> T) -> T {
        lock.lock(); defer { lock.unlock() }; return body()
    }
}
```

- [ ] **Step 4: Run; verify pass**

```bash
xcodebuild -workspace "$WS" -scheme AgenticToolkitMacOS -destination "$DEST" -derivedDataPath "$DD" -only-testing AgenticToolkitCoreTests test 2>&1 | tail -20
```
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add packages/apple/AgenticToolkit/Core/Chat/MockChatSession.swift \
        packages/apple/AgenticToolkit/Tests/AgenticToolkitCoreTests/Chat/MockChatSessionTests.swift \
        packages/apple/AgenticToolkit/AgenticToolkit.xcodeproj
git commit -m "feat: MockChatSession + tests

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: `ChatToolSource` seam

**Files:**
- Create: `Core/Chat/ChatToolSource.swift`

- [ ] **Step 1: Implement**

```swift
// Core/Chat/ChatToolSource.swift
import Foundation

/// Supplies tools to a chat engine and executes tool calls. Lets an engine
/// (e.g. `LocalChatSession`) run a tool loop without depending on MCP directly —
/// the MCP-backed implementation lives in the macOS module.
public protocol ChatToolSource: Sendable {
    /// Tool definitions to advertise to the model for this turn.
    func toolDefinitions() async -> [ToolDefinition]
    /// Execute a tool call the model requested. Returns the result text and
    /// whether it was an error.
    func callTool(name: String, argumentsJSON: Data) async -> (content: String, isError: Bool)
}
```

- [ ] **Step 2: Regenerate & build**

```bash
cc-xcgen packages/apple/AgenticToolkit
xcodebuild -workspace "$WS" -scheme AgenticToolkitMacOS -destination "$DEST" -derivedDataPath "$DD" build 2>&1 | tail -20
```
Expected: BUILD SUCCEEDED.

- [ ] **Step 3: Commit**

```bash
git add packages/apple/AgenticToolkit/Core/Chat/ChatToolSource.swift \
        packages/apple/AgenticToolkit/AgenticToolkit.xcodeproj
git commit -m "feat: ChatToolSource seam for engine tool loops

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: `LocalChatSession` (TDD)

The plugin-backed engine. Owns one turn end-to-end with streaming, plus the
tool loop (dormant unless a `ChatToolSource` is supplied). The transport is
injected as an `eventStreamFactory` so the turn logic is testable without
spawning `claude`.

**Files:**
- Create: `macOS/Features/AIPlugins/LocalChatSession.swift`
- Test: `Tests/AgenticToolkitMacOSTests/Chat/LocalChatSessionTests.swift`

- [ ] **Step 1: Write the failing test** (uses a fake event-stream factory; no subprocess)

```swift
// Tests/AgenticToolkitMacOSTests/Chat/LocalChatSessionTests.swift
import Testing
import Foundation
import AIPluginKit
@testable import AgenticToolkitCore
@testable import AgenticToolkitMacOS

@Suite("LocalChatSession")
struct LocalChatSessionTests {

    @Test("streams deltas from the injected transport and finishes")
    func streamsAndFinishes() async {
        // Fake transport: yields two text deltas then end, ignoring spec/plugin.
        let factory: LocalChatSession.EventStreamFactory = { _, _ in
            AsyncThrowingStream { c in
                c.yield(.textDelta("Hel"))
                c.yield(.textDelta("lo"))
                c.yield(.end(stopReason: "end_turn"))
                c.finish()
            }
        }
        let session = LocalChatSession(
            resolvePlugin: { StubPlugin() },
            makeContext: { _ in AIChatContext(messages: [], model: "m", systemPrompt: nil, tools: [], config: AIPluginConfig([:])) },
            eventStreamFactory: factory,
            toolSource: nil
        )

        var deltas: [String] = []
        var finished = false
        let collector = Task {
            for await event in session.events() {
                if case .responseDelta(_, let t) = event { deltas.append(t) }
                if case .responseFinished = event { finished = true; break }
            }
        }
        try? await Task.sleep(for: .milliseconds(20))
        session.send("hi")
        await collector.value
        session.close()

        #expect(deltas.joined() == "Hello")
        #expect(finished)
    }
}

/// Minimal plugin stub — never actually invoked by the fake factory.
private final class StubPlugin: AIPlugin, @unchecked Sendable {
    init() {}
    func buildRequest(_ context: AIChatContext) throws -> AIRequestSpec {
        AIRequestSpec(transport: .command(executableURL: URL(fileURLWithPath: "/bin/echo"),
                                          arguments: [], stdin: nil, environment: [:]))
    }
    func makeDecoder() -> any AIStreamDecoder { PassthroughDecoder() }
}
private final class PassthroughDecoder: AIStreamDecoder {
    func consume(_ data: Data) -> [AIStreamEvent] { [] }
}
```

- [ ] **Step 2: Run; verify fail (`LocalChatSession` undefined)**

```bash
xcodebuild -workspace "$WS" -scheme AgenticToolkitMacOS -destination "$DEST" -derivedDataPath "$DD" -only-testing AgenticToolkitMacOSTests test 2>&1 | tail -25
```
Expected: `cannot find 'LocalChatSession' in scope`.

- [ ] **Step 3: Implement**

```swift
// macOS/Features/AIPlugins/LocalChatSession.swift
import Foundation
import AgenticToolkitCore
import AIPluginKit

/// A `ChatSession` that runs turns through an `AIPlugin`. Owns conversation
/// history (plugins are stateless), builds an `AIChatContext` per turn, drives
/// an injected event-stream factory (default: `PluginTransport.run`), and emits
/// `ChatEvent`s. If a `ChatToolSource` is supplied it runs a tool loop.
public final class LocalChatSession: ChatSession, @unchecked Sendable {

    /// Injection seam for the transport, so turn logic is testable without I/O.
    public typealias EventStreamFactory =
        @Sendable (AIRequestSpec, any AIPlugin) -> AsyncThrowingStream<AIStreamEvent, Error>

    private let resolvePlugin: @Sendable () -> (any AIPlugin)?
    private let makeContext: @Sendable ([AIChatMessage]) -> AIChatContext
    private let eventStreamFactory: EventStreamFactory
    private let toolSource: (any ChatToolSource)?

    private let lock = NSLock()
    private var continuation: AsyncStream<ChatEvent>.Continuation?
    private var history: [AIChatMessage] = []
    private var liveTurn: Task<Void, Never>?

    private static let maxToolIterations = 8

    public init(
        resolvePlugin: @escaping @Sendable () -> (any AIPlugin)?,
        makeContext: @escaping @Sendable ([AIChatMessage]) -> AIChatContext,
        eventStreamFactory: @escaping EventStreamFactory = { PluginTransport.run(spec: $0, plugin: $1) },
        toolSource: (any ChatToolSource)? = nil
    ) {
        self.resolvePlugin = resolvePlugin
        self.makeContext = makeContext
        self.eventStreamFactory = eventStreamFactory
        self.toolSource = toolSource
    }

    public func events() -> AsyncStream<ChatEvent> {
        AsyncStream { continuation in
            lock.lock(); self.continuation = continuation; lock.unlock()
            continuation.yield(.stateChanged(.ready))
            continuation.onTermination = { [weak self] _ in self?.liveTurn?.cancel() }
        }
    }

    public func send(_ text: String) {
        liveTurn = Task { [weak self] in await self?.runTurn(userText: text) }
    }

    public func interrupt() { liveTurn?.cancel() }

    public func close() {
        liveTurn?.cancel()
        emit(.stateChanged(.closed))
        withLock { continuation }?.finish()
    }

    // MARK: - Turn

    private func runTurn(userText: String) async {
        emit(.userMessage(ChatMessage(role: .user, text: userText)))
        appendHistory(AIChatMessage(role: .user, content: userText))
        emit(.stateChanged(.responding))

        guard let plugin = resolvePlugin() else {
            emit(.turnFailed(ChatError(message: "No AI provider is configured.", isRetryable: false)))
            emit(.stateChanged(.ready))
            return
        }

        let assistantID = UUID().uuidString
        var responseOpened = false

        do {
            for _ in 0..<Self.maxToolIterations {
                let tools = await toolSource?.toolDefinitions() ?? []
                let context = makeContext(snapshotHistory()).withTools(tools)
                let spec = try plugin.buildRequest(context)

                var turnText = ""
                var pendingTools: [(id: String, name: String, args: Data)] = []
                for try await event in eventStreamFactory(spec, plugin) {
                    if Task.isCancelled { break }
                    switch event {
                    case .textDelta(let chunk):
                        if !responseOpened { emit(.responseStarted(messageID: assistantID)); responseOpened = true }
                        turnText += chunk
                        emit(.responseDelta(messageID: assistantID, text: chunk))
                    case .toolUse(let id, let name, let args):
                        pendingTools.append((id, name, args))
                        emit(.toolCall(messageID: assistantID, name: name, phase: .started))
                    case .end:
                        continue
                    }
                }

                if !turnText.isEmpty { appendHistory(AIChatMessage(role: .assistant, content: turnText)) }

                if pendingTools.isEmpty || toolSource == nil { break }

                for use in pendingTools {
                    appendHistory(.toolUse(id: use.id, name: use.name, argumentsJSON: use.args))
                    let result = await toolSource!.callTool(name: use.name, argumentsJSON: use.args)
                    appendHistory(.toolResult(id: use.id, content: result.content, isError: result.isError))
                    emit(.toolCall(messageID: assistantID, name: use.name, phase: .completed))
                }
            }
            if responseOpened { emit(.responseFinished(messageID: assistantID, stopReason: nil)) }
            emit(.stateChanged(.ready))
        } catch {
            emit(.turnFailed(ChatError(message: "Sorry, something went wrong. Let's try again.", isRetryable: true)))
            emit(.stateChanged(.ready))
        }
    }

    // MARK: - Helpers

    private func emit(_ event: ChatEvent) { withLock { continuation }?.yield(event) }
    private func appendHistory(_ m: AIChatMessage) { lock.lock(); history.append(m); lock.unlock() }
    private func snapshotHistory() -> [AIChatMessage] { lock.lock(); defer { lock.unlock() }; return history }
    private func withLock<T>(_ body: () -> T) -> T { lock.lock(); defer { lock.unlock() }; return body() }
}

private extension AIChatContext {
    /// Returns a copy of the context with `tools` replaced. (AIChatContext is a
    /// value type; this re-wraps it so the per-turn tool list can vary.)
    func withTools(_ tools: [ToolDefinition]) -> AIChatContext {
        AIChatContext(
            messages: messages,
            model: model,
            systemPrompt: systemPrompt,
            tools: tools.map { AIToolSpec(name: $0.name, description: $0.description, parametersJSONSchema: $0.parametersJSONSchema) },
            config: config
        )
    }
}
```

> **Implementer note:** verify `AIChatContext`'s memberwise init parameter labels against `AIPluginKit/AIChatContext.swift` (the discovery showed `messages/model/systemPrompt/tools/config`, with `maxTokens` defaulted). If `tools` on the struct is `[AIToolSpec]` and there's no public memberwise init, add a small initializer to `AIChatContext` or build it directly in `makeContext` and drop `withTools`. Keep `makeContext` as the single place that knows `AIChatContext`'s shape.

- [ ] **Step 4: Run; verify pass**

```bash
xcodebuild -workspace "$WS" -scheme AgenticToolkitMacOS -destination "$DEST" -derivedDataPath "$DD" -only-testing AgenticToolkitMacOSTests test 2>&1 | tail -25
```
Expected: `LocalChatSession` test passes.

- [ ] **Step 5: Commit**

```bash
git add packages/apple/AgenticToolkit/macOS/Features/AIPlugins/LocalChatSession.swift \
        packages/apple/AgenticToolkit/Tests/AgenticToolkitMacOSTests/Chat/LocalChatSessionTests.swift \
        packages/apple/AgenticToolkit/AgenticToolkit.xcodeproj
git commit -m "feat: LocalChatSession (plugin-backed streaming engine) + tests

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: `MCPChatToolSource` (preserve the MCP tool loop)

Ports the namespacing / flatten / `callTool` helpers out of the old
`ChatViewModel` into a `ChatToolSource`, so the MCP capability survives the
ViewModel rewrite. Not wired to any shipping consumer yet (BitBag passes no
registry); this keeps the code alive and testable for the remote/tool phase.

**Files:**
- Create: `macOS/Features/AIPlugins/MCPChatToolSource.swift`

- [ ] **Step 1: Implement** (logic lifted verbatim from `ChatViewModel`'s tool helpers)

```swift
// macOS/Features/AIPlugins/MCPChatToolSource.swift
import Foundation
import MCP
import AgenticToolkitCore

/// `ChatToolSource` backed by an `MCPServerRegistry` and a fixed set of active
/// server ids. Mirrors the dispatch the chat view model used to do inline:
/// namespacing tool names `server__tool`, decoding arguments, flattening text
/// content. Decoupled from any engine via the `ChatToolSource` protocol.
public final class MCPChatToolSource: ChatToolSource, @unchecked Sendable {

    private let registry: MCPServerRegistry
    private let activeServerIds: Set<UUID>
    private static let separator = "__"

    public init(registry: MCPServerRegistry, activeServerIds: Set<UUID>) {
        self.registry = registry
        self.activeServerIds = activeServerIds
    }

    public func toolDefinitions() async -> [ToolDefinition] {
        let pairs = await registry.tools(forIds: activeServerIds)
        return pairs.compactMap { client, tool in
            guard let schema = try? JSONEncoder().encode(tool.inputSchema) else { return nil }
            return ToolDefinition(
                name: Self.namespaced(server: client.name, tool: tool.name),
                description: tool.description ?? "",
                parametersJSONSchema: schema
            )
        }
    }

    public func callTool(name: String, argumentsJSON: Data) async -> (content: String, isError: Bool) {
        let pairs = await registry.tools(forIds: activeServerIds)
        guard let pair = pairs.first(where: { Self.namespaced(server: $0.0.name, tool: $0.1.name) == name }) else {
            return ("Unknown tool: \(name)", true)
        }
        let arguments = try? JSONDecoder().decode([String: Value].self, from: argumentsJSON)
        do {
            let (content, isError) = try await pair.0.callTool(name: pair.1.name, arguments: arguments)
            return (Self.flatten(content), isError)
        } catch {
            return ("Tool error: \(error.localizedDescription)", true)
        }
    }

    private static func namespaced(server: String, tool: String) -> String { "\(server)\(separator)\(tool)" }

    private static func flatten(_ content: [MCP.Tool.Content]) -> String {
        content.compactMap { if case let .text(text, _, _) = $0 { return text } else { return nil } }
            .joined(separator: "\n")
    }
}
```

> **Implementer note:** confirm `MCPServerRegistry.tools(forIds:)`, `MCPClientProtocol.name`, and `callTool(name:arguments:)` signatures against the old `ChatViewModel` (they were used there). Match exactly.

- [ ] **Step 2: Regenerate & build**

```bash
cc-xcgen packages/apple/AgenticToolkit
xcodebuild -workspace "$WS" -scheme AgenticToolkitMacOS -destination "$DEST" -derivedDataPath "$DD" build 2>&1 | tail -20
```
Expected: BUILD SUCCEEDED.

- [ ] **Step 3: Commit**

```bash
git add packages/apple/AgenticToolkit/macOS/Features/AIPlugins/MCPChatToolSource.swift \
        packages/apple/AgenticToolkit/AgenticToolkit.xcodeproj
git commit -m "feat: MCPChatToolSource (preserves MCP tool loop behind ChatToolSource)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Rewrite `ChatViewModel` as a reducer-pump (TDD)

**Files:**
- Rewrite: `macOS/Features/AIChatWindow/ChatViewModel.swift`
- Test: `Tests/AgenticToolkitMacOSTests/Chat/ChatViewModelTests.swift`

- [ ] **Step 1: Write the failing test** (drives a real `MockChatSession`)

```swift
// Tests/AgenticToolkitMacOSTests/Chat/ChatViewModelTests.swift
import Testing
import Foundation
@testable import AgenticToolkitCore
@testable import AgenticToolkitMacOS

@Suite("ChatViewModel")
@MainActor
struct ChatViewModelTests {

    @Test("folds a mock session's stream into a growing transcript")
    func foldsMockStream() async {
        let vm = ChatViewModel(session: MockChatSession(reply: "Hello", chunkSize: 2))
        try? await Task.sleep(for: .milliseconds(20))
        vm.sendMessage("hi")

        // wait until the assistant message is complete
        for _ in 0..<200 {
            if vm.messages.last?.role == .assistant, vm.messages.last?.isStreaming == false { break }
            try? await Task.sleep(for: .milliseconds(10))
        }

        #expect(vm.messages.count == 2)
        #expect(vm.messages[0].role == .user)
        #expect(vm.messages[0].text == "hi")
        #expect(vm.messages[1].role == .assistant)
        #expect(vm.messages[1].text == "Hello")
        #expect(vm.messages[1].isStreaming == false)
    }
}
```

- [ ] **Step 2: Run; verify fail (`ChatViewModel(session:)` undefined)**

```bash
xcodebuild -workspace "$WS" -scheme AgenticToolkitMacOS -destination "$DEST" -derivedDataPath "$DD" -only-testing AgenticToolkitMacOSTests test 2>&1 | tail -25
```
Expected: `incorrect argument label in call (have 'session:', expected 'backend:')` or similar.

- [ ] **Step 3: Rewrite the file**

```swift
// macOS/Features/AIChatWindow/ChatViewModel.swift
import Foundation
import Combine
import os
import AgenticToolkitCore

/// Drives the chat window by folding a `ChatSession`'s event stream into an
/// observable transcript. All chat logic (turns, tools, transport) lives in the
/// session; this type only owns UI state and the reducer pump.
@MainActor
public final class ChatViewModel: ObservableObject {

    @Published public private(set) var messages: [ChatMessage] = []
    @Published public private(set) var state: ChatSessionState = .connecting

    /// True while a turn is in flight — kept for the existing view bindings that
    /// referenced `isTyping`.
    public var isTyping: Bool { if case .responding = state { return true } else { return false } }

    private let session: any ChatSession
    private var pump: Task<Void, Never>?

    public init(session: any ChatSession) {
        self.session = session
        pump = Task { [weak self] in
            guard let stream = self?.session.events() else { return }
            for await event in stream {
                guard let self else { return }
                self.apply(event)
            }
        }
    }

    deinit { pump?.cancel() }

    // MARK: - Public API

    public func sendMessage(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        session.send(trimmed)
    }

    public func interrupt() { session.interrupt() }

    public func clearHistory() { messages.removeAll() }

    // MARK: - Reducer pump

    private func apply(_ event: ChatEvent) {
        ChatTranscriptReducer.apply(event, to: &messages, state: &state)
    }
}

extension ChatViewModel: Loggable {
    public static nonisolated let logger = makeLogger()
}
```

> **Implementer note:** This removes `registry`/`activeServerIds` and the inline MCP loop (now in `LocalChatSession` + `MCPChatToolSource`). `ChatView` references `viewModel.registry` for the MCP chips bar — Task 9 removes that branch (the chips were never shown: no shipping consumer passed a registry). The `clearHistory()` API is retained for any menu binding; it clears the local transcript only.

- [ ] **Step 4: Run; expect compile errors in `ChatView`/`AIChatCoordinator`/`PluginConfigPanel`** — these are fixed in Tasks 9–11. To verify the ViewModel test in isolation first, temporarily build only the Core+ViewModel by running the test after Task 9–11 edits. For now, proceed to Task 9 (the build goes green at the end of Task 11). Do **not** commit a non-compiling tree — Tasks 8–11 form one compile unit; commit at the end of Task 9 onward as each file is fixed. (Stage `ChatViewModel.swift` now; commit together with Task 9.)

---

## Task 9: `ChatView` streaming consumption + perf

**Files:**
- Modify: `macOS/Features/AIChatWindow/ChatView.swift`

- [ ] **Step 1: Remove the MCP chips branch and bind state**

In `setupViews()`, replace the `if let registry = viewModel.registry { … } else { topAnchorView = self }` block with `let topAnchorView: NSView = self` (no chips bar in Phase 1). Remove the now-unused `topDivider`/`chipsBar` locals.

- [ ] **Step 2: Update `bindViewModel()` to coalesce renders**

The streaming fix is already delivered by the reducer mutating the last bubble's
`text` and `@Published messages` re-firing `rebuildTranscript()`. The only risk
is rebuild frequency at token rates, so coalesce: at most one rebuild per runloop
tick regardless of how many deltas land.

```swift
private func bindViewModel() {
    viewModel.$messages
        .receive(on: DispatchQueue.main)
        .sink { [weak self] _ in self?.scheduleRender() }
        .store(in: &cancellables)

    viewModel.$state
        .receive(on: DispatchQueue.main)
        .sink { [weak self] _ in self?.scheduleRender() }
        .store(in: &cancellables)
}

/// Coalesce high-frequency delta updates into one rebuild per runloop tick.
private var renderScheduled = false
private func scheduleRender() {
    guard !renderScheduled else { return }
    renderScheduled = true
    DispatchQueue.main.async { [weak self] in
        guard let self else { return }
        self.renderScheduled = false
        self.rebuildTranscript()
    }
}
```

> **Implementer note:** keep the existing `rebuildTranscript()` body and the
> `layout()` resize-rebuild from prior work intact — only the *binding* changes
> (route both publishers through `scheduleRender()` instead of calling
> `rebuildTranscript()` directly). Replace any `viewModel.isTyping` reads with the
> new `isTyping` computed property (call sites unchanged) and gate the typing
> indicator on `state == .responding`. **Optional follow-up (not this task):** an
> in-place fast path that grows only the last `MessageBubbleView` via a new
> `updateText(_:maxWidth:)` instead of a full rebuild — defer unless a long
> transcript visibly janks.

- [ ] **Step 3: Build & stage (still part of the Task 8–11 compile unit)**

```bash
cc-xcgen packages/apple/AgenticToolkit
xcodebuild -workspace "$WS" -scheme AgenticToolkitMacOS -destination "$DEST" -derivedDataPath "$DD" build 2>&1 | tail -20
```
Expected: errors remaining only in `AIChatCoordinator` (Task 10) — those are next. If `ChatView`/`ChatViewModel` errors remain, fix before proceeding.

---

## Task 10: `AIChatCoordinator.makeSession` + legacy bridge

**Files:**
- Create: `macOS/Features/AIChatWindow/ChatBackendSession.swift`
- Modify: `macOS/Features/AIChatWindow/AIChatCoordinator.swift`

- [ ] **Step 1: The bridge adapter**

```swift
// macOS/Features/AIChatWindow/ChatBackendSession.swift
import Foundation
import AgenticToolkitCore

/// Adapts a legacy `ChatBackend` to the `ChatSession` contract so consumers that
/// still pass `makeBackend:` keep working during migration. Holds the transcript
/// itself (the old backend was stateless) and re-sends full history each turn.
///
/// Deprecated alongside `ChatBackend`; delete once all consumers pass `makeSession:`.
public final class ChatBackendSession: ChatSession, @unchecked Sendable {

    private let backend: ChatBackend
    private let lock = NSLock()
    private var continuation: AsyncStream<ChatEvent>.Continuation?
    private var history: [ChatBackendMessage] = []
    private var liveTurn: Task<Void, Never>?

    public init(backend: ChatBackend) { self.backend = backend }

    public func events() -> AsyncStream<ChatEvent> {
        AsyncStream { continuation in
            lock.lock(); self.continuation = continuation; lock.unlock()
            continuation.yield(.stateChanged(.ready))
            continuation.onTermination = { [weak self] _ in self?.liveTurn?.cancel() }
        }
    }

    public func send(_ text: String) {
        liveTurn = Task { [weak self] in await self?.runTurn(text) }
    }

    public func interrupt() { liveTurn?.cancel() }
    public func close() { liveTurn?.cancel(); withLock { continuation }?.finish() }

    private func runTurn(_ text: String) async {
        emit(.userMessage(ChatMessage(role: .user, text: text)))
        appendHistory(ChatBackendMessage(role: .user, content: text))
        emit(.stateChanged(.responding))

        let assistantID = UUID().uuidString
        var opened = false
        var turnText = ""
        let stream = await backend.sendMessages(snapshotHistory(), tools: [])
        do {
            for try await event in stream {
                switch event {
                case .textDelta(let chunk):
                    if !opened { emit(.responseStarted(messageID: assistantID)); opened = true }
                    turnText += chunk
                    emit(.responseDelta(messageID: assistantID, text: chunk))
                case .toolUse(let id, let name, _):
                    emit(.toolCall(messageID: assistantID, name: name, phase: .started))
                    _ = id
                case .end:
                    continue
                }
            }
            if !turnText.isEmpty { appendHistory(ChatBackendMessage(role: .assistant, content: turnText)) }
            if opened { emit(.responseFinished(messageID: assistantID, stopReason: nil)) }
            emit(.stateChanged(.ready))
        } catch {
            emit(.turnFailed(ChatError(message: "Sorry, something went wrong. Let's try again.", isRetryable: true)))
            emit(.stateChanged(.ready))
        }
    }

    private func emit(_ e: ChatEvent) { withLock { continuation }?.yield(e) }
    private func appendHistory(_ m: ChatBackendMessage) { lock.lock(); history.append(m); lock.unlock() }
    private func snapshotHistory() -> [ChatBackendMessage] { lock.lock(); defer { lock.unlock() }; return history }
    private func withLock<T>(_ b: () -> T) -> T { lock.lock(); defer { lock.unlock() }; return b() }
}
```

- [ ] **Step 2: Update the coordinator** — keep both initializers; both build a `ChatViewModel(session:)`.

```swift
// AIChatCoordinator.swift — replace makeBackend storage + ensureWindow
private let makeSession: () -> any ChatSession

public init(makeSession: @escaping () -> any ChatSession) {
    self.makeSession = makeSession
    super.init()
    // ... menuContributions + scriptingKeys block unchanged ...
}

/// Legacy convenience: wraps a `ChatBackend` factory in the bridge.
@available(*, deprecated, message: "Pass makeSession: with a ChatSession (e.g. LocalChatSession).")
public convenience init(makeBackend: @escaping () -> ChatBackend) {
    self.init(makeSession: { ChatBackendSession(backend: makeBackend()) })
}

public func ensureWindow() {
    guard windowController == nil else { return }
    let chatViewModel = ChatViewModel(session: makeSession())
    viewModel = chatViewModel
    windowController = AIChatWindowController(viewModel: chatViewModel)
}
```

> **Implementer note:** keep the existing `menuContributions`, `scriptingKeys`, `showWindow`, and scripting `value/setValue` code exactly as-is — only the stored property, the two inits, and `ensureWindow` change.

- [ ] **Step 3: Build — toolkit should be fully green now**

```bash
cc-xcgen packages/apple/AgenticToolkit
xcodebuild -workspace "$WS" -scheme AgenticToolkitMacOS -destination "$DEST" -derivedDataPath "$DD" build 2>&1 | tail -20
```
Expected: BUILD SUCCEEDED (PluginConfigPanel still uses `ChatViewModel(backend:)` → fix in Task 11; if it errors, do Task 11 Step 1 before building).

- [ ] **Step 4: Run the full toolkit test suite**

```bash
xcodebuild -workspace "$WS" -scheme AgenticToolkitMacOS -destination "$DEST" -derivedDataPath "$DD" test 2>&1 | tail -30
```
Expected: all suites pass (Core reducer/mock + macOS LocalChatSession/ChatViewModel).

- [ ] **Step 5: Commit Tasks 8–10 together** (one compile unit)

```bash
git add packages/apple/AgenticToolkit/macOS/Features/AIChatWindow/ChatViewModel.swift \
        packages/apple/AgenticToolkit/macOS/Features/AIChatWindow/ChatView.swift \
        packages/apple/AgenticToolkit/macOS/Features/AIChatWindow/ChatBackendSession.swift \
        packages/apple/AgenticToolkit/macOS/Features/AIChatWindow/AIChatCoordinator.swift \
        packages/apple/AgenticToolkit/Tests/AgenticToolkitMacOSTests/Chat/ChatViewModelTests.swift \
        packages/apple/AgenticToolkit/AgenticToolkit.xcodeproj
git commit -m "feat: ChatViewModel folds a ChatSession; streaming view; legacy bridge

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: Migrate the in-toolkit + BitBag chat construction sites

**Files:**
- Modify: `macOS/Features/.../PluginConfigPanel.swift` (toolkit — settings preview chat)
- Modify: `apple/Bitbag/Bitbag/Sources/AppServices.swift` (BitBag repo)

- [ ] **Step 1: `PluginConfigPanel.swift`** — replace the direct `ChatViewModel(backend:)` construction.

Find (≈line 61): `let chatView = ChatView(viewModel: ChatViewModel(backend: backend))` where `backend` is an `AIPluginChatBackend` pinned to a `SinglePluginChatConfigProvider`. Replace with a `LocalChatSession` pinned to that descriptor:

```swift
let provider = SinglePluginChatConfigProvider(descriptor: descriptor /* existing */)
let session = LocalChatSession(
    resolvePlugin: { [pluginManager] in try? pluginManager.loadPlugin(identifier: provider.selectedPluginIdentifier) },
    makeContext: { history in
        AIChatContext(
            messages: history,
            model: provider.selectedModel,
            systemPrompt: nil,
            tools: [],
            config: AIPluginConfig(provider.pluginConfigValues)
        )
    }
)
let chatView = ChatView(viewModel: ChatViewModel(session: session))
```

> **Implementer note:** match how this panel currently obtains `pluginManager`, `descriptor`, and constructs `SinglePluginChatConfigProvider`. `resolvePlugin`/`makeContext` read the provider on the calling actor; since the provider is `@MainActor`, capture the resolved values up front if the closures must be `@Sendable` (snapshot `selectedPluginIdentifier`/`selectedModel`/`pluginConfigValues` into locals before building the closures).

- [ ] **Step 2: BitBag `AppServices.swift`** — switch the coordinator to `makeSession`.

Replace:
```swift
aiChat = AIChatCoordinator(makeBackend: {
    AIPluginChatBackend(pluginManager: manager, configProvider: configProvider)
})
```
with:
```swift
aiChat = AIChatCoordinator(makeSession: {
    let id = configProvider.selectedPluginIdentifier
    let model = configProvider.selectedModel
    let values = configProvider.pluginConfigValues
    return LocalChatSession(
        resolvePlugin: { [manager] in try? manager.loadPlugin(identifier: id) },
        makeContext: { history in
            AIChatContext(messages: history, model: model, systemPrompt: nil,
                          tools: [], config: AIPluginConfig(values))
        }
    )
})
```

> **Implementer note:** the closure runs on `@MainActor` (AppServices is `@MainActor`); snapshot the three config values at session-creation time as shown. If BitBag wants the model/provider to reflect mid-session settings changes, that's a Phase-2 concern (the remote session re-reads per turn). Confirm `manager`/`configProvider` are the same locals used today.

- [ ] **Step 3: Build the toolkit, then BitBag**

```bash
cc-xcgen packages/apple/AgenticToolkit
xcodebuild -workspace "$WS" -scheme AgenticToolkitMacOS -destination "$DEST" -derivedDataPath "$DD" build 2>&1 | tail -20
# BitBag (separate project/workspace under the bitbag worktree):
cd /Users/mfullerton/Development/projects/adh-daemon/.claude/worktrees/bitbag/apple/Bitbag
cc-xcgen .  # if Bitbag uses XcodeGen; otherwise open the existing project
xcodebuild -workspace ../Bitbag.xcworkspace -scheme bitbag -destination "$DEST" -derivedDataPath "$DD" build 2>&1 | tail -20
```
Expected: both BUILD SUCCEEDED.

> **Implementer note:** confirm BitBag's exact workspace/scheme names from `apple/Bitbag/project.yml` (target `bitbag`, product `BitBag`) and the `.xcworkspace` path.

- [ ] **Step 4: Launch BitBag and verify streaming by eye**

Use the `run` skill (or launch the built `.app`), open the **Bitbag** chat window from the menu, send a message with Claude (Local) selected, and confirm the reply now appears **token-by-token** rather than all at once. Resize the window mid-stream and confirm bubbles reflow.

- [ ] **Step 5: Commit (two repos)**

```bash
# toolkit
cd /Users/mfullerton/Development/projects/adh-daemon/.claude/worktrees/bitbag/external/agentictoolkit
git add packages/apple/AgenticToolkit/macOS/Features/AIPlugins/PluginConfigPanel.swift \
        packages/apple/AgenticToolkit/AgenticToolkit.xcodeproj
git commit -m "refactor: settings preview chat uses LocalChatSession

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
# BitBag
cd /Users/mfullerton/Development/projects/adh-daemon/.claude/worktrees/bitbag
git add apple/Bitbag/Bitbag/Sources/AppServices.swift
git commit -m "feat: BitBag chat uses LocalChatSession (token-by-token streaming)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 12: Deprecate the legacy path & final verification

**Files:**
- Modify: `macOS/Features/AIChatWindow/ChatBackend.swift` (add deprecation note)
- Modify: `macOS/Features/AIPlugins/AIPluginChatBackend.swift` (add deprecation note)

- [ ] **Step 1: Mark the legacy types deprecated** (do NOT delete — AgenticToolkitApp/Whippet still use them via the bridge)

Add a doc comment to `ChatBackend` and `AIPluginChatBackend`:
```swift
/// - Important: Deprecated. New code conforms to `ChatSession` (e.g.
///   `LocalChatSession`). This rides `ChatBackendSession` until AgenticToolkitApp
///   and Whippet migrate, then it (and `WhippetChatBackend`) are deleted.
```
(Use a doc comment, not `@available(*, deprecated)`, to avoid warning-spam in the still-bridged consumers.)

- [ ] **Step 2: Full clean build + test**

```bash
cd /Users/mfullerton/Development/projects/adh-daemon/.claude/worktrees/bitbag/external/agentictoolkit
xcodebuild -workspace "$WS" -scheme AgenticToolkitMacOS -destination "$DEST" -derivedDataPath "$DD" clean build test 2>&1 | tail -30
```
Expected: BUILD SUCCEEDED, all suites pass.

- [ ] **Step 3: Commit**

```bash
git add packages/apple/AgenticToolkit/macOS/Features/AIChatWindow/ChatBackend.swift \
        packages/apple/AgenticToolkit/macOS/Features/AIPlugins/AIPluginChatBackend.swift
git commit -m "docs: deprecate ChatBackend/AIPluginChatBackend in favor of ChatSession

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Follow-up (NOT in this plan)
- Migrate `AgenticToolkitApp` `Features.swift` and Whippet `Features.swift` to `makeSession`; delete `ChatBackend`, `AIPluginChatBackend`, `WhippetChatBackend`, `ChatBackendSession`, `ChatStreamEvent`, `ChatBackendMessage`.
- Phase 2: `RemoteChatSession` (ADH SSE) + JWT sign-in + conversation resume.
- Phase 3: warm persistent `claude` process inside `LocalChatSession`.
- Wire `MCPChatToolSource` into a consumer that surfaces the MCP chips bar.
