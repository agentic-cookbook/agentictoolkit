# Toolkit Repo Pattern

How this repo (`agentictoolkit`) is laid out and consumed. The layout
mirrors the sibling `agentic-persona-toolkit` so the same mental model
carries between repos.

## What the pattern solves

Shipping reusable per-platform libraries from a single repo to two audiences:

- **First-party consumers** — apps inside the org that want live edits.
  They embed the repo as a git submodule, reference the in-tree
  Xcode projects directly, and rebuild from source — no separately
  published package needed.
- **External consumers** — eventual third-party users who pick up a
  tagged release (Swift Package, framework distribution, etc.) once
  publishing is wired up. Same source tree; the publish layer flips on
  at release time.

## Repo layout

The repo root holds no language-specific manifests. Each platform owns a
top-level dir under `packages/<platform>/` which is the ROOT of that
platform's native build system.

```
<repo>/
├── README.md
├── AGENTS.md
├── install.sh                       # bootstrap (regenerate Xcode projects)
├── install-for-submodule-use.sh     # consumer-side convenience
├── .claude/CLAUDE.md                # agent-facing repo conventions
├── docs/
└── packages/
    ├── apple/                       # AgenticToolkit.xcworkspace + 3 project.yml files
    ├── android/                     # (TBD)
    └── windows/                     # (TBD)
```

Targets may only depend on other targets within the same platform — never
on ad-hoc paths outside their workspace.

## The Apple platform shape

`packages/apple/` is the Apple platform root. Its three XcodeGen-backed
Xcode projects are wired together by `AgenticToolkit.xcworkspace`:

- `AgenticToolkit/` — four framework targets
  (`AgenticToolkitCore`, `AgenticToolkitCoreUI`, `AgenticToolkitCoreMacOS`,
  `AgenticToolkitMacOS`) + matching test bundles.
- `AgenticToolkitApp/` — host app (`AgenticToolkitApp.app`) that embeds
  all four toolkit frameworks.
- `AIPlugins/` — `AIPluginsShared.framework` plus five `.aiplugin` bundles
  that link (without embedding) the toolkit frameworks so they share the
  host's loaded image at `dlopen` time.

**`project.yml` is the source of truth.** Edits to the generated
`project.pbxproj` are lost on the next regeneration. The repo-root
`install.sh` regenerates all three projects in one shot.

## Consumer wiring — first-party submodule path

See [`consuming-as-submodule.md`](consuming-as-submodule.md) for the full
walkthrough. In short:

1. `git submodule add <toolkit-url> vendor/agentictoolkit`
2. Add `packages/apple/AgenticToolkit.xcworkspace` (or one of its
   sub-projects) to the consumer's own Xcode workspace.
3. Run `./vendor/agentictoolkit/install-for-submodule-use.sh` after
   fetching a new revision (regenerates xcodeproj files from
   `project.yml`).

Live edits in `vendor/agentictoolkit/packages/apple/.../Sources/` are
picked up by the consumer's next Xcode build.

## Consumer wiring — future external path

Once the toolkit publishes tagged releases (Swift Package Manager,
framework distribution, or both), external consumers reference the
toolkit by version instead of by submodule path. The source-tree layout
does not change; only the consumer's package reference does.

## The two install scripts at the repo root

| Script | Audience | What it does |
|---|---|---|
| `install.sh` | Toolkit developers | Regenerates every Apple Xcode project from `project.yml`; prints pointers to the build/open commands. |
| `install-for-submodule-use.sh` | Consumers | Consumer-side convenience: re-runs `xcodegen` so the generated `.xcodeproj` files match the `project.yml` in the freshly-pulled submodule revision. |

Both live at the repo root because the consumer invokes the second one
through the submodule path
(`./vendor/agentictoolkit/install-for-submodule-use.sh`).

## Adapting for other ecosystems

The principle: package metadata points at source by default, and a
publish-time mechanism (or, for Apple, a tagged release) flips it to a
prebuilt artifact with no code changes. Demos and first-party apps live
in the same repo and consume the packages exactly the way external
consumers will.

| Ecosystem | Source-by-default mechanism | Publish-time mechanism |
|---|---|---|
| Swift | XcodeGen workspace + in-tree project references | Tagged release with `from:` (SPM) or framework distribution |
| TypeScript / npm | `main`/`types`/`exports` → `src/`, plus `transpilePackages` in the consumer | `publishConfig` flips to `dist/` |
| Python | `pyproject.toml` with editable installs (`pip install -e ./packages/foo`) | Standard `pip install` from a published wheel |
| Go | `replace github.com/org/pkg => ./packages/pkg` in the consumer's `go.mod` | Tagged release; consumer drops the `replace` |
| Rust | `path = "../../packages/pkg"` in the consumer's `Cargo.toml` | Tagged crate publish; consumer switches to `version = "..."` |
