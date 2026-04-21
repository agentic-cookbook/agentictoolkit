# agentictoolkit

A cross-platform toolkit for agentic development workflows.

## Tech Stack
- **Apple platforms**: Swift 6.0, SPM, macOS 14+ / iOS 17+ / tvOS 17+ / watchOS 10+
- **Windows**: TBD
- **Android**: TBD

## Build

Each framework module under `apple/AgenticToolkit/` is its own Swift Package.
The app and plugin bundles are XcodeGen-generated Xcode projects that consume
those packages as local SPM dependencies.

```bash
# Per-package build/test (pick any module):
cd apple/AgenticToolkit/AgenticToolkitCore && swift build
cd apple/AgenticToolkit/AgenticToolkitCore && swift test

# Full workspace (app + plugins + packages):
cd apple/AgenticToolkitApp && cc-xcgen         # regenerate app xcodeproj
cd apple/AIPlugins && cc-xcgen                 # regenerate plugins xcodeproj
open apple/AgenticToolkit.xcworkspace
```

## Architecture

Cross-platform repo with per-platform directories:
- `apple/AgenticToolkit/AgenticToolkit<Module>/` — one Swift Package per module, laid out as `Package.swift` + `Source/` + `Tests/`
- `apple/AgenticToolkitApp/` — XcodeGen Xcode project, consumes each module package as a local SPM dependency
- `apple/AIPlugins/` — XcodeGen Xcode project (NSBundle plugins). Each plugin bundle depends on the `AgenticToolkitAIPluginsCore` product of the `AgenticToolkitAIPlugins` package. Each plugin's post-build script installs its `.bundle` into `~/.agenticplugins/`
- `windows/` — TBD
- `android/` — TBD

### Apple packages

| Package                         | Source dir                              | Depends on                                                                   |
|---------------------------------|-----------------------------------------|------------------------------------------------------------------------------|
| `AgenticToolkitCore`            | `AgenticToolkitCore/`                   | —                                                                            |
| `AgenticToolkitScripting`       | `AgenticToolkitScripting/`              | `AgenticToolkitCore`                                                         |
| `AgenticToolkitCoreUI`          | `AgenticToolkitCoreUI/`                 | `AgenticToolkitCore`, `AgenticToolkitScripting`                              |
| `AgenticToolkitAIProvider`      | `AgenticToolkitAIProvider/`             | `AgenticToolkitCore`                                                         |
| `AgenticToolkitLoggingWindow`   | `AgenticToolkitLoggingWindow/`          | `AgenticToolkitCore`, `AgenticToolkitCoreUI`                                 |
| `AgenticToolkitChatWindow`      | `AgenticToolkitChatWindow/`             | `AgenticToolkitCore`, `AgenticToolkitCoreUI`                                 |
| `AgenticToolkitNotesWindow`     | `AgenticToolkitNotesWindow/`            | `AgenticToolkitCore`, `AgenticToolkitCoreUI`                                 |
| `AgenticToolkitSettingsWindow`  | `AgenticToolkitSettingsWindow/`         | `AgenticToolkitCore`, `AgenticToolkitCoreUI`                                 |
| `AgenticToolkitTerminalWindow`  | `AgenticToolkitTerminalWindow/`         | `AgenticToolkitCore`, `AgenticToolkitCoreUI`, `AgenticToolkitAIProvider`, `SwiftTerm` |
| `AgenticToolkitFileBrowser`     | `AgenticToolkitFileBrowser/`            | `AgenticToolkitCore`, CodeEdit packages                                      |
| `AgenticToolkitAIPlugins`       | `AgenticToolkitAIPlugins/`              | `AgenticToolkitCore`, `AgenticToolkitCoreUI`, `AgenticToolkitSettingsWindow`, `AgenticToolkitChatWindow` |
| `AgenticToolkitDocument`        | `AgenticToolkitDocument/`               | `AgenticToolkitCore`, `AgenticToolkitFileBrowser`, `AgenticToolkitTerminalWindow` |

The `AgenticToolkitAIPlugins` package ships two library products built from two targets in the same package:
- `AgenticToolkitAIPluginsCore` — the plugin-facing API (protocols, message/credential types). Plugin bundles in `apple/AIPlugins/` depend on this product. Depends on `AgenticToolkitCore` and `AgenticToolkitSettingsWindow`.
- `AgenticToolkitAIPlugins` — the host-side `PluginManager` and chat wiring. Depends on `AgenticToolkitAIPluginsCore` internally and is consumed by the app.

Keeping both targets in one package (rather than splitting `AgenticToolkitAIPluginsCore` into `apple/AIPlugins/`) avoids a circular `AgenticToolkit → AIPlugins` dependency.

`AgenticToolkitCore` is Foundation-only; `AgenticToolkitCoreUI` holds cross-cutting AppKit utilities (windowing, shared views); feature packages are named after their most general function.

## Conventions

- AppKit only for macOS UI (no SwiftUI except widgets)
- All changes via PRs and git worktrees; never commit directly to main

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current
