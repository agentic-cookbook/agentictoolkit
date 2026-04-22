# agentictoolkit

A cross-platform toolkit for agentic development workflows.

## Tech Stack
- **Apple platforms**: Swift 6.0, SPM, macOS 14+ / iOS 17+ / tvOS 17+ / watchOS 10+
- **Windows**: TBD
- **Android**: TBD

## Build

`apple/AgenticToolkit/` is a single Swift Package. Each module is a target
under `Sources/AgenticToolkit<Module>/` with tests under
`Tests/AgenticToolkit<Module>Tests/`. The app and plugin bundles are
XcodeGen-generated Xcode projects that consume the umbrella package as a
local SPM dependency.

```bash
# Package build/test (single command covers every module):
cd apple/AgenticToolkit && swift build
cd apple/AgenticToolkit && swift test

# Full workspace (app + plugins + packages):
cd apple/AgenticToolkitApp && cc-xcgen         # regenerate app xcodeproj
cd apple/AIPlugins && cc-xcgen                 # regenerate plugins xcodeproj
open apple/AgenticToolkit.xcworkspace
```

## Architecture

Cross-platform repo with per-platform directories:
- `apple/AgenticToolkit/` — umbrella Swift Package. `Package.swift` at the root, modules as targets under `Sources/AgenticToolkit<Module>/`, tests under `Tests/AgenticToolkit<Module>Tests/`
- `apple/AgenticToolkitApp/` — XcodeGen Xcode project, embeds the dynamic `AgenticToolkitPluginHost` product (for the host/plugin boundary) and links the other automatic products
- `apple/AIPlugins/` — XcodeGen Xcode project (NSBundle plugins). Each plugin bundle links (without embedding) the `AgenticToolkitPluginHost` product so it shares one loaded image with the host at runtime. Each plugin's post-build script installs its `.bundle` into `~/.agenticplugins/`
- `windows/` — TBD
- `android/` — TBD

### Apple modules (targets in the umbrella package)

| Target                          | Source dir                                         | Depends on                                                                   |
|---------------------------------|----------------------------------------------------|------------------------------------------------------------------------------|
| `AgenticToolkitCore`            | `Sources/AgenticToolkitCore/`                      | —                                                                            |
| `AgenticToolkitScripting`       | `Sources/AgenticToolkitScripting/`                 | `AgenticToolkitCore`                                                         |
| `AgenticToolkitCoreUI`          | `Sources/AgenticToolkitCoreUI/`                    | `AgenticToolkitCore`, `AgenticToolkitScripting`                              |
| `AgenticToolkitAIProvider`      | `Sources/AgenticToolkitAIProvider/`                | `AgenticToolkitCore`                                                         |
| `AgenticToolkitLoggingWindow`   | `Sources/AgenticToolkitLoggingWindow/`             | `AgenticToolkitCore`, `AgenticToolkitCoreUI`                                 |
| `AgenticToolkitChatWindow`      | `Sources/AgenticToolkitChatWindow/`                | `AgenticToolkitCore`, `AgenticToolkitCoreUI`                                 |
| `AgenticToolkitNotesWindow`     | `Sources/AgenticToolkitNotesWindow/`               | `AgenticToolkitCore`, `AgenticToolkitCoreUI`                                 |
| `AgenticToolkitSettingsWindow`  | `Sources/AgenticToolkitSettingsWindow/`            | `AgenticToolkitCore`, `AgenticToolkitCoreUI`                                 |
| `AgenticToolkitTerminalWindow`  | `Sources/AgenticToolkitTerminalWindow/`            | `AgenticToolkitCore`, `AgenticToolkitCoreUI`, `AgenticToolkitAIProvider`, `SwiftTerm` |
| `AgenticToolkitFileBrowser`     | `Sources/AgenticToolkitFileBrowser/`               | `AgenticToolkitCore`, CodeEdit packages                                      |
| `AgenticToolkitAIPlugins`       | `Sources/AgenticToolkitAIPlugins/`                 | `AgenticToolkitCore`, `AgenticToolkitCoreUI`, `AgenticToolkitSettingsWindow`, `AgenticToolkitChatWindow` |
| `AgenticToolkitDocument`        | `Sources/AgenticToolkitDocument/`                  | `AgenticToolkitCore`, `AgenticToolkitFileBrowser`, `AgenticToolkitTerminalWindow` |

`AgenticToolkitCore` is Foundation-only; `AgenticToolkitCoreUI` holds cross-cutting AppKit utilities (windowing, shared views); feature targets are named after their most general function.

### Product layout

Each target has an automatic `.library` product of the same name — consumers (host app, tests, Whippet, Stenographer) can reference any module by its target name. Xcode picks linkage per build-graph (usually static).

One additional **dynamic** product, `AgenticToolkitPluginHost`, bundles the 6 modules that cross the host/plugin boundary (`Core`, `Scripting`, `CoreUI`, `SettingsWindow`, `ChatWindow`, `AIPlugins`). The host app embeds it; plugin bundles link it without embedding. At runtime both ends resolve the bundled types to the same loaded image, preventing the duplicate class registrations and type-identity mismatches that static-linking the same SPM modules into both host and plugin would produce.

Adding a module to the host/plugin boundary means adding its target name to `AgenticToolkitPluginHost`'s `targets:` list in `Package.swift`. See `docs/research/spm-dynamic-linking.md` for the full rationale — the asymmetric automatic-plus-one-dynamic-umbrella shape is a deliberate workaround for an SPM limitation, not an invented pattern.

## Conventions

- AppKit only for macOS UI (no SwiftUI except widgets)
- Worktrees + PRs are the standard workflow, initiated by the user

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current
