# Model Context Protocol (MCP) integration

Reference note for the MCP support that landed in 12 commits across
`linting` (April–May 2026). Captures the design decisions, the SDK
choices, and the things we deliberately left for later — so the next
person to touch tool-calling has the reasoning, not just the diff.

---

## The problem

Before this work, `AIPlugin` declared an `AIPluginCapability.functionCalling`
flag, but the message API was text-only. There was no way for a plugin
to receive tool definitions or emit `tool_use` events, and no shared
mechanism for plugging external tool servers into the chat. Every
plugin that wanted tool support would have had to invent its own
plumbing.

Model Context Protocol is the obvious standardization. It's a JSON-RPC
schema for "host application talks to a tool server" — already
supported by Anthropic, OpenAI Codex, Cursor, and dozens of community
servers (filesystem, GitHub, Postgres, Slack…). Adding it to the
toolkit means any plugin gains tool-calling for free, and the host app
gets a "host-as-MCP-server" pattern that lets host-defined behaviors
(open a window, read a doc) appear as tools to its own chat without a
subprocess hop.

## Dependency

We use the official Swift SDK:

```yaml
# apple/AgenticToolkit/project.yml
packages:
  ModelContextProtocol:
    url: https://github.com/modelcontextprotocol/swift-sdk
    from: 0.11.0
```

The resolved version at integration time was **0.12.0**. We link the
`MCP` product into `AgenticToolkitCore` — the lowest module that needs
it — so every higher module (`AgenticToolkitMacOS`, plugins, the app)
inherits transitively.

The SDK gives us:

- `MCP.Client` and `MCP.Server` actors with `withMethodHandler(...)`
  registration.
- Transports: `StdioTransport(input:output:)` for subprocess servers,
  `HTTPClientTransport(endpoint:streaming:)` for HTTP/SSE servers, and
  `InMemoryTransport.createConnectedPair()` for in-process pairs.
- Codable DTOs (`MCP.Tool`, `MCP.Tool.Content`, `Value`) and the
  `ListTools` / `CallTool` JSON-RPC method types.

We never manipulate raw JSON-RPC; everything goes through the SDK's
typed surface.

## Architecture

The integration has four layers:

1. **Configuration / persistence** (`AgenticToolkitCore/MCP/`).
   - `MCPServerConfiguration` — Codable struct with a `Transport` enum
     (`.stdio(command:args:env:)` / `.http(endpoint:streaming:)`) and an
     `isEnabled` flag.
   - `MCPSettings.swift` declares two `StorableSetting` keys:
     `mcpServerConfigurations` (regular `SettingsStore`) and
     `mcpServerSecrets` (with `isSecure: true`, routed to keychain).
     Splitting them lets the user inspect/edit non-secret config without
     ever touching keychain, and keeps env-var values like
     `GITHUB_TOKEN` out of UserDefaults / the SQLite store.
2. **Live connections** (`AgenticToolkitCore/MCP/`).
   - `MCPClient` — actor wrapping `MCP.Client` for one server.
     Owns the transport, exposes `connect()` / `disconnect()` /
     `cachedTools` / `callTool(name:arguments:)`. Re-fetches tools on
     connect and on `ToolListChangedNotification`.
   - `MCPServerRegistry` — `@MainActor` class. Subscribes to the
     `SettingsStore` publisher, opens/closes/updates `MCPClient`
     instances to match the persisted set. `tools(forIds:)` returns
     `(client, tool)` pairs for the dispatch loop. Tests inject a
     `clientFactory` to avoid spawning real subprocesses.
3. **Plugin / backend surface**
   (`AgenticToolkitCore/AIPlugins/` + `apple/AgenticToolkit/macOS/`).
   - New DTOs in `Core`: `ToolDefinition`, `ChatStreamEvent`
     (`.textDelta` / `.toolUse` / `.end`), `ToolResult`. Lives in `Core`
     so MCP code can produce them directly.
   - `AIPluginMessage` and `ChatBackendMessage` gained `toolUse` and
     `toolResult` role variants.
   - `AIPlugin` and `ChatBackend` gained a tool-aware
     `sendMessages(_:tools:...)` overload that returns
     `AsyncThrowingStream<ChatStreamEvent, Error>`. The default protocol
     implementation delegates to the existing text-only method when
     `tools` is empty, wrapping the string stream in `.textDelta`
     events. This means every existing plugin/backend keeps working
     without changes.
   - `AIPluginChatBackend` and `WhippetChatBackend` override the new
     method, translate `[ToolDefinition]` into the provider's tool
     format (Anthropic `tools` array, OpenAI `functions`, etc.), and
     emit `.toolUse` events from provider responses.
4. **Dispatch loop and UI** (`apple/AgenticToolkit/macOS/`).
   - `ChatViewModel` accepts an `MCPServerRegistry?` and a
     `Set<UUID>` of `activeServerIds`. The drain loop is now an
     event loop: collect text deltas, collect pending tool uses, run
     them through the registry, append results back into the history,
     re-prompt. Iteration is capped to 8 turns to stop a misbehaving
     model from spinning forever.
   - `MCPChipsBarView` is a small `NSHostingView` that sits above the
     chat transcript when the view-model has a registry. It shows
     "MCP: 2 of 5" with a popover picker so the user toggles which
     servers are live for *this* conversation.
   - `MCPServersPanelViewController` is a premade
     `ComposableSettings.SettingsPanelSplitViewController` mirroring
     `AIPanelViewController` — host apps drop it into their settings
     panel list with `MCPServersPanelViewController(registry:store:)`.
   - `HostMCPServer` is a sample showing the host-as-MCP-server
     pattern: a `MCP.Server` paired with `InMemoryTransport` exposing
     `host_app_info` / `host_open_chat_window`. Hosts wire the
     `clientTransport` to an `MCP.Client` themselves.

### Why a separate registry instead of folding MCP into `AIPluginManager`

`AIPluginManager` is about *which AI model is talking*. The registry is
about *what tools that conversation has access to*. These rotate
independently — the user can switch from Claude to GPT-4 without
changing their MCP server set, and they can flip individual servers on
and off mid-conversation. Coupling them would have forced re-creating
the plugin to change the tool set, which is the wrong granularity.

### Why the additive `sendMessages` overload instead of a breaking change

Every existing concrete plugin and backend (including stubs in tests
and the Whippet adapter) keeps compiling and working unchanged because
the new method has a default implementation that wraps the old text
stream. This let us land the plumbing as a single non-breaking commit
(stage 5) before any backend started honoring tools, so commits 5–8
land incrementally without ever breaking the build. We can deprecate
the old method in a follow-up once every known backend has been
converted.

### Why namespaced tool names

A model with three MCP servers attached can easily see name collisions
(both `filesystem` and `github` define `list`, etc.). The dispatch loop
namespaces tool names as `<serverName>__<toolName>` when assembling the
tool list and strips the prefix back off when dispatching.
Double-underscore is deliberate: Anthropic and OpenAI both reject `.`
in tool names with the regex `^[a-zA-Z0-9_-]{1,128}$`, so a dot
separator would have failed validation immediately.

### Why secrets are a separate `StorableSetting`

`MCPServerConfiguration` is `Codable` and round-trips through plain
JSON in UserDefaults / the toolkit's SQLite provider. Embedding env
secrets in the same blob would mean every `get` call hits the keychain
even when only the non-secret fields are wanted (e.g. populating the
settings panel list). Splitting them keeps the regular path
keychain-free and lets the secrets dictionary be loaded only when a
client actually connects.

### Why `HostMCPServer` doesn't auto-register itself

It would be reasonable for `HostMCPServer` to call into
`MCPServerRegistry` to expose itself as if it were a configured server
— but the registry only manages clients created from
`MCPServerConfiguration`, and `Transport` has only `.stdio` and `.http`
variants. Adding an in-process variant would mean either a third enum
case threaded through every consumer, or a parallel
`register(client:id:)` API on the registry. Both expand the public
surface of a feature whose first-cut consumers don't need it.

The sample is therefore self-contained: it exposes
`HostMCPServer.clientTransport`, and the host app wires that to an
`MCP.Client` itself. If a future host wants the chat window to see
host-defined tools alongside user-configured servers, that's the
moment to revisit the enum.

## The host-as-MCP-server pattern

Most MCP servers in the wild are **separate processes** — `npx -y
@modelcontextprotocol/server-filesystem /tmp` spawns a Node subprocess
that the host talks to over stdio. That model makes sense when the
server is third-party code with its own dependencies, but it's
overkill for tools that *only* exist to expose host-app behavior:
"open a window," "what plugins are loaded," "navigate to document X."
Those tools have no meaning outside the running host process — there's
nothing to spawn.

`HostMCPServer` (`apple/AgenticToolkit/macOS/Features/MCP/HostMCPServer.swift`)
is the in-process answer. It wraps the SDK's `MCP.Server` actor with
an in-memory transport pair so the same process can act as both the
MCP server (publishing tools) and an MCP client (consuming them via
the chat dispatch loop).

### Construction

```swift
let host = await HostMCPServer(
    appName: "AgenticPluginTester",
    appVersion: "1.0.0",
    pluginNames: pluginManager.availablePlugins.map(\.displayName),
    openChatWindow: { [weak self] in
        Task { @MainActor [weak self] in self?.chatWindowController.showWindow() }
    }
)
try await host.start()
```

The init is `async` because the SDK's transport-pair creation is
async. `openChatWindow` is the only side-effecting handler — it's
passed in as a closure rather than reaching into the host directly so
`HostMCPServer` itself stays free of AppKit imports and is testable
from `AgenticToolkitCore` consumers.

### The two demo tools

- **`host_app_info`** — zero-arg query. Returns a short JSON blob with
  `appName`, `appVersion`, and `plugins[]`. Demonstrates the
  read-side: the model can ask "what app am I in?" and route its
  responses accordingly.
- **`host_open_chat_window`** — zero-arg side-effect. Invokes the
  `openChatWindow` closure. Demonstrates the write-side: a model with
  this tool attached can decide it needs a fresh chat surface and
  spawn one. Returns a one-line confirmation.

These exist as a *pattern*, not as a final API. Real hosts are
expected to replace them with their own toolset (`document.create`,
`navigate.toSection`, `selection.read`, etc.).

### Transport wiring

The SDK provides `InMemoryTransport.createConnectedPair()`, which
returns two transports already linked to each other. `HostMCPServer`
keeps one (`serverTransport`, private) and exposes the other
(`clientTransport`, public). The host app then constructs an
`MCP.Client` with the public transport — that client and the embedded
server are now talking over a Swift-native pair, no JSON-RPC
serialization, no subprocess.

```swift
// Inside HostMCPServer
private let serverTransport: any Transport
public let clientTransport: any Transport

public init(...) async {
    let pair = await InMemoryTransport.createConnectedPair()
    self.serverTransport = pair.0
    self.clientTransport = pair.1
    // ...register handlers, store appName/version/plugins/openChatWindow
}

public func start() async throws {
    try await mcpServer.start(transport: serverTransport)
}
```

The host app never sees `serverTransport` — that's an implementation
detail. It only sees `clientTransport`, which it uses exactly the way
it would use any other `Transport` value handed to `MCP.Client`.

### Why `nonisolated` on the tool-list builder

`HostMCPServer` is `@MainActor` (it captures the chat-window opener,
which is AppKit-bound), but `withMethodHandler(ListTools.self)` takes
a `@Sendable` closure that may run off-main. The static method that
builds the `[MCP.Tool]` list for `ListTools` is therefore marked
`private nonisolated static`:

```swift
private nonisolated static func staticToolDefinitions() -> [MCP.Tool] {
    [
        MCP.Tool(name: "host_app_info", description: ..., inputSchema: ...),
        MCP.Tool(name: "host_open_chat_window", description: ..., inputSchema: ...)
    ]
}
```

Pure data, no captured state, safe to call from any actor. The
`CallTool` handler does need actor-isolated state (the appName, the
opener closure), so it's a regular instance method and the closure
hops to `self` via `await`.

### When to use this pattern vs. a configured server

Rule of thumb:

- **`HostMCPServer` (in-process) when**: tools manipulate or describe
  the running host process — windows, current document, loaded
  plugins, in-memory selection. No data leaves the process.
- **`MCPServerConfiguration` (stdio/http) when**: tools are external
  services or third-party code — filesystems, GitHub APIs, databases,
  community MCP servers. Process isolation, separate dependencies,
  user-installable.

A host that needs both keeps `HostMCPServer` always-on (started in
`AppDelegate`) and lets the user add stdio/http servers through the
settings panel. The dispatch loop sees both kinds of clients
identically — `MCPClient` (registry-managed) and the host's manually
constructed `MCP.Client` (host-managed) both expose the same
`callTool` surface.

## Trade-offs we accepted

- **Per-window, not per-session, server selection.** There is no
  persistent `ChatSession` type today, so the active-server set is per
  `ChatViewModel` instance and resets on relaunch. When chat history
  persistence lands, the active set should be persisted alongside it.
- **No OAuth UI.** The Swift SDK supports the OAuth client-credentials
  flow, but there's no UI for the auth-code redirect. Servers that
  require OAuth (e.g. some hosted MCP endpoints) need to be configured
  with a pre-issued bearer token in the env-var dictionary.
- **No sampling, elicitation, roots, or resource-subscribe.** The
  protocol covers more than tool-calling; we wired up tool-calling
  only. Resources / sampling / elicitation are easy to add as separate
  layers and weren't on the critical path for "let plugins run tools."
- **Tool-iteration cap is fixed at 8.** A pathological model can still
  emit 7 tool calls per turn for 8 turns and burn budget; the cap only
  prevents *infinite* spinning, not just "expensive." A future
  refinement is per-conversation tool-call budgeting.
- **Reconciliation is whole-set, not delta.** Each
  `SettingsStore` change re-walks the whole configuration list. This
  is fine at any reasonable server count; if servers ever number in
  the hundreds, we'd want to track diffs.

## Verification

End-to-end smoke-tested by running the sample `AgenticToolkitApp`:

- Settings → MCP Servers shows the new panel with the empty state.
- The chat window's chip bar reads "No MCP servers" when none are
  configured, then updates live as configurations are added.
- Adding the official `filesystem` server (`npx -y
  @modelcontextprotocol/server-filesystem /tmp`) flips the row's
  status dot green and tools become callable from chat.
- A `github` server with a token round-trips through Keychain (visible
  in Keychain Access, not in UserDefaults plist).

Unit tests in `apple/AgenticToolkit/Tests/AgenticToolkitCoreTests/MCP/`
cover the Codable round-trip for `MCPServerConfiguration`, the
secrets-routing in `MCPSettings`, and the registry's reconciliation
behavior using an injected fake `MCPClient` factory.

## Files

Added:

- `apple/AgenticToolkit/Core/MCP/MCPServerConfiguration.swift`
- `apple/AgenticToolkit/Core/MCP/MCPSettings.swift`
- `apple/AgenticToolkit/Core/MCP/MCPClient.swift`
- `apple/AgenticToolkit/Core/MCP/MCPServerRegistry.swift`
- `apple/AgenticToolkit/Core/AIPlugins/ToolDefinition.swift`
- `apple/AgenticToolkit/Core/AIPlugins/ChatStreamEvent.swift`
- `apple/AgenticToolkit/Core/AIPlugins/ToolResult.swift`
- `apple/AgenticToolkit/macOS/Features/MCP/Settings/MCPServersPanelViewController.swift`
- `apple/AgenticToolkit/macOS/Features/MCP/HostMCPServer.swift`
- `apple/AgenticToolkit/macOS/Features/AIChatWindow/MCPChipsBarView.swift`

Modified:

- `apple/AgenticToolkit/project.yml` — added the SDK package.
- `apple/AgenticToolkit/macOS/Features/AIPlugins/AIPlugin.swift`
- `apple/AgenticToolkit/macOS/Features/AIPlugins/AIPluginMessage.swift`
- `apple/AgenticToolkit/macOS/Features/AIPlugins/AIPluginChatBackend.swift`
- `apple/AgenticToolkit/macOS/Features/AIChatWindow/ChatBackend.swift`
- `apple/AgenticToolkit/macOS/Features/AIChatWindow/ChatView.swift`
- `apple/AgenticToolkit/macOS/Features/AIChatWindow/ChatViewModel.swift`
- `apple/AgenticToolkit/macOS/Features/AIChatWindow/WhippetChatBackend.swift`
- `apple/AgenticToolkitApp/AgenticToolkitApp/AppDelegate.swift`
- `apple/AgenticToolkitApp/AgenticToolkitApp/Settings/AppSettingsWindowController.swift`

`StubChatBackend` did not need changes — it inherits the default
delegating implementation of the new tool-aware method.
