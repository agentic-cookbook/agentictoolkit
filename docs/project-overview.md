## Project Summary

`agentictoolkit` is a Swift/macOS framework that provides cross-platform building blocks for agentic workflows. It consists of two primary components: `AIPlugins` (an NSBundle-based plugin architecture for loading AI tool implementations at runtime) and the `AgenticToolkit` framework itself (Swift APIs for tool invocation, context passing, and result handling). Intended as the shared Swift foundation that other agentic-cookbook macOS tools depend on.

## Type & Tech Stack

- **Type:** Swift framework / plugin SDK
- **Language:** Swift
- **Build system:** Swift Package Manager
- **Platform:** macOS (primary), with cross-platform SPM targets where applicable
- **Architecture:** NSBundle dynamic plugin loading (`AIPlugins`) + static framework (`AgenticToolkit`)

## GitHub URL

https://github.com/agentic-cookbook/agentictoolkit

## Directory Structure

```
agentictoolkit/
├── Sources/
│   ├── AgenticToolkit/      # core framework (tool invocation, context, result types)
│   └── AIPlugins/           # NSBundle plugin host + discovery
├── Plugins/                 # example/reference plugin bundles
├── Tests/
│   └── AgenticToolkitTests/
└── Package.swift
```

## Key Files & Components

- `Sources/AgenticToolkit/Tool.swift` — `Tool` protocol; defines `invoke(input:context:) async throws -> ToolResult` interface
- `Sources/AgenticToolkit/Context.swift` — shared context type passed through tool chains
- `Sources/AIPlugins/PluginHost.swift` — discovers and loads NSBundle plugins from a configured directory; vends `Tool` instances
- `Sources/AIPlugins/PluginRegistry.swift` — maintains the runtime catalog of loaded plugin bundles
- `Plugins/` — reference plugin implementations conforming to the `Tool` protocol
- `Tests/AgenticToolkitTests/` — XCTest suite covering tool invocation and plugin loading
- `Package.swift` — SPM manifest; defines `AgenticToolkit` and `AIPlugins` library targets

## Claude Configuration

No `.claude/` directory or `CLAUDE.md` detected in the scan. No MCP servers configured.

## Planning & Research Documents

No planning or research documents detected in the scan.

## Git History & Current State

Core protocol and plugin host architecture established; recent commits refine the `Tool` protocol and plugin discovery path. NSBundle-based dynamic loading is the current active design direction.

## Build & Test Commands

```bash
swift build                         # build all targets
swift test                          # run XCTest suite
swift build -c release              # release build
```

## Notes

`agenticdaemon` is the likely primary consumer of `agentictoolkit` — the daemon can load plugin bundles via `AIPlugins.PluginHost` to gain new tool capabilities without recompiling the daemon binary. The `Tool` protocol is the stable ABI contract between the framework and dynamically loaded plugins.
