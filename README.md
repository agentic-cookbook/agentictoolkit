# agentic-toolkit

A cross-platform toolkit for agentic development workflows.

## Structure

| Directory | Platform | Language |
|-----------|----------|----------|
| `apple/`  | macOS, iOS, tvOS, watchOS | Swift |
| `windows/`| Windows  | TBD |
| `android/`| Android  | TBD |

## Apple Platforms (Swift Package)

The `apple/` directory contains a Swift package (`AgenticToolkit`).

### As a local dependency (submodule)

Add this repo as a git submodule, then in Xcode: **File > Add Package Dependencies > Add Local** and select the `apple/` directory.

### As a remote dependency

```swift
.package(url: "https://github.com/agentic-cookbook/agentic-toolkit.git", from: "0.1.0")
```

A root-level `Package.swift` symlink enables SPM resolution from the repo URL.

### Build & Test

```bash
cd apple
swift build
swift test
```
