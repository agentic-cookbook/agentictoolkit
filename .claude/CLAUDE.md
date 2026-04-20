# agentictoolkit

A cross-platform toolkit for agentic development workflows.

## Tech Stack
- **Apple platforms**: Swift 6.0, SPM, macOS 14+ / iOS 17+ / tvOS 17+ / watchOS 10+
- **Windows**: TBD
- **Android**: TBD

## Build

```bash
cd apple/AgenticToolkit && swift build
cd apple/AgenticToolkit && swift test
```

The canonical in-repo build is XcodeGen-based:

```bash
cd apple/AgenticToolkit && cc-xcgen            # regenerate xcodeproj from project.yml
open apple/AgenticToolkit/AgenticToolkit.xcworkspace
```

## Architecture

Cross-platform repo with per-platform directories:
- `apple/AgenticToolkit/` — Swift Package + XcodeGen project (targets as top-level dirs, tests colocated under `<Feature>/Tests/`)
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
