# agentic-toolkit

A cross-platform toolkit for agentic development workflows.

## Tech Stack
- **Apple platforms**: Swift 6.0, SPM, macOS 14+ / iOS 17+ / tvOS 17+ / watchOS 10+
- **Windows**: TBD
- **Android**: TBD

## Build

```bash
cd apple && swift build
cd apple && swift test
```

## Architecture

Cross-platform repo with per-platform directories:
- `apple/` — Swift Package (`AgenticToolkit` library + tests)
- `windows/` — TBD
- `android/` — TBD

Root `Package.swift` is a symlink to `apple/Package.swift` for remote SPM resolution.

## Conventions

- AppKit only for macOS UI (no SwiftUI except widgets)
- All changes via PRs and git worktrees; never commit directly to main
