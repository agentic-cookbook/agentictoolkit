# agentictoolkit

A cross-platform toolkit for agentic development workflows.

## Tech Stack
- **Apple platforms**: Swift 6.0, SPM, macOS 14+ / iOS 17+ / tvOS 17+ / watchOS 10+
- **Windows**: TBD
- **Android**: TBD

## Build

The framework tier is a Swift Package; the app and plugin bundles remain
XcodeGen-generated Xcode projects that consume the package.

```bash
cd apple/AgenticToolkit && swift build         # package-level build
cd apple/AgenticToolkit && swift test          # package tests

# Full workspace (app + plugins + package):
cd apple/AgenticToolkitApp && cc-xcgen         # regenerate app xcodeproj
cd apple/Plugins && cc-xcgen                   # regenerate plugins xcodeproj
open apple/AgenticToolkit.xcworkspace
```

## Architecture

Cross-platform repo with per-platform directories:
- `apple/AgenticToolkit/` — Swift Package (`Package.swift`); framework sources at the top level, tests under `Tests/<Module>Tests/`
- `apple/AgenticToolkitApp/` — XcodeGen Xcode project, consumes the package as an SPM dependency
- `apple/Plugins/` — XcodeGen Xcode project (NSBundle plugins), consumes the `AgenticToolkit` SPM product; each plugin's post-build script installs its `.bundle` into `~/.agenticplugins/`
- `windows/` — TBD
- `android/` — TBD

Root `Package.swift` is a symlink to `apple/AgenticToolkit/Package.swift` for remote SPM resolution.

### Apple targets

| Target           | Source dir        | Depends on                |
|------------------|-------------------|---------------------------|
| `Core`           | `Core/`           | —                         |
| `Scripting`      | `Scripting/`      | `Core`                    |
| `CoreUI`         | `CoreUI/`         | `Core`, `Scripting`       |
| `AIProvider`     | `AIProvider/`     | `Core`                    |
| `LoggingWindow`  | `LoggingWindow/`  | `Core`, `CoreUI`          |
| `ChatWindow`     | `ChatWindow/`     | `Core`, `CoreUI`          |
| `NotesWindow`    | `NotesWindow/`    | `Core`, `CoreUI`          |
| `SettingsWindow` | `SettingsWindow/` | `Core`, `CoreUI`          |
| `TerminalWindow` | `TerminalWindow/` | `Core`, `CoreUI`, `AIProvider`, `SwiftTerm` |
| `FileBrowser`    | `FileBrowser/`    | `Core`, CodeEdit packages |

Targets with no `Agentic` prefix. `Core` is Foundation-only; `CoreUI` holds cross-cutting AppKit utilities (windowing, shared views); feature targets are named after their most general function.

## Conventions

- AppKit only for macOS UI (no SwiftUI except widgets)
- All changes via PRs and git worktrees; never commit directly to main

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current
