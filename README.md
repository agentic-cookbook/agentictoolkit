# agentictoolkit

A cross-platform toolkit for agentic development workflows.

## Layout

Each platform folder under `packages/` is the **root of its native build
system** — its conventional manifest file lives there.

| Platform | Folder | Manifest | Status |
|---|---|---|---|
| Apple | `packages/apple/` | `project.yml` (XcodeGen) + `AgenticToolkit.xcworkspace` | active |
| Android | `packages/android/` | (TBD) | placeholder |
| Windows | `packages/windows/` | (TBD) | placeholder |

The Apple platform is a workspace of three XcodeGen-backed Xcode projects:
`AgenticToolkit` (four toolkit frameworks), `AgenticToolkitApp` (host app),
and `AIPlugins` (`AIPluginsShared.framework` plus five `.aiplugin` bundles).

## Build

One-shot bootstrap (regenerates Apple Xcode projects from `project.yml`):

```bash
./install.sh
```

Open the workspace:

```bash
open packages/apple/AgenticToolkit.xcworkspace
```

Full `xcodebuild` invocations (including the `-derivedDataPath` flag this
repo requires) live in [`.claude/CLAUDE.md`](.claude/CLAUDE.md).

## Design

How this repo is laid out and how it's consumed:
[`docs/repo-pattern.md`](docs/repo-pattern.md).

Consumer setup walkthrough (git submodule path):
[`docs/consuming-as-submodule.md`](docs/consuming-as-submodule.md).

Agent-oriented orientation: [`AGENTS.md`](AGENTS.md).
Repo conventions and build rules: [`.claude/CLAUDE.md`](.claude/CLAUDE.md).
