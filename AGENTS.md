# AGENTS.md

Orientation for agents (and humans) working in this repo.

## Purpose

A cross-platform toolkit for agentic development workflows. Each platform
folder under `packages/` is the **root of its native build system** — its
conventional manifest file lives there.

## Layout

| Platform | Folder | Manifest | Status |
|---|---|---|---|
| Apple | `packages/apple/` | `project.yml` (XcodeGen) + `AgenticToolkit.xcworkspace` | active |
| Android | `packages/android/` | (TBD) | placeholder |
| Windows | `packages/windows/` | (TBD) | placeholder |

The Apple platform is a workspace of three XcodeGen-backed Xcode projects:

- `packages/apple/AgenticToolkit/` — four framework targets
  (`AgenticToolkitCore`, `AgenticToolkitCoreUI`, `AgenticToolkitCoreMacOS`,
  `AgenticToolkitMacOS`) and their test bundles.
- `packages/apple/AgenticToolkitApp/` — host app
  (`AgenticToolkitApp.app`).
- `packages/apple/AIPlugins/` — `AIPluginsShared.framework` plus five
  `.aiplugin` bundles (`ClaudeAPI`, `ClaudeLocal`, `Google`, `OpenAI`,
  `OpenAICompatible`).

## Where to look first

- Repo conventions, build commands, ground rules →
  [`.claude/CLAUDE.md`](.claude/CLAUDE.md)
- Toolkit code review checklist → [`docs/toolkit-checklist.md`](docs/toolkit-checklist.md)
- Repo layout pattern (this design) → [`docs/repo-pattern.md`](docs/repo-pattern.md)
- Consumer flow (git submodule path) → [`docs/consuming-as-submodule.md`](docs/consuming-as-submodule.md)

## Build entry points

- One-shot bootstrap (regenerate Xcode projects): `./install.sh`
- Open the workspace:
  `open packages/apple/AgenticToolkit.xcworkspace`
- Build everything from the command line (see `.claude/CLAUDE.md` for the
  `-derivedDataPath` flags this repo requires).

## Conventions you should know

- The repo root has **no language manifest** and no loose build configs.
  Tooling that needs one should `cd` into the relevant platform folder.
- `project.yml` is the source of truth for every Apple Xcode project.
  Hand-edits to `project.pbxproj` are lost on the next regeneration; run
  `xcodegen` (or `cc-xcgen`) after editing `project.yml`.
- Libraries may only depend on other targets within the same platform —
  never on ad-hoc paths outside their workspace.
