# agentictoolkit

A cross-platform toolkit for agentic development workflows. Consolidates
the Apple (`agentictoolkit`) and Web (`agentic-web-toolkit`) sources into
one repo so shared code lives in one place.

## Layout

Each platform folder under `packages/` is the **root of its native build
system** — its conventional manifest file lives there.

| Platform | Folder | Manifest | Status |
|---|---|---|---|
| Apple | `packages/apple/` | `project.yml` (XcodeGen) + `AgenticToolkit.xcworkspace` | active |
| Web | `packages/web/` | `package.json` + `pnpm-workspace.yaml` | active |
| Android | `packages/android/` | (TBD) | placeholder |
| Windows | `packages/windows/` | (TBD) | placeholder |

The Apple platform is a workspace of three XcodeGen-backed Xcode projects:
`AgenticToolkit` (four toolkit frameworks), `AgenticToolkitApp` (host app),
and `AIPlugins` (`AIPluginsShared.framework` plus five `.aiplugin` bundles).

The Web platform is a pnpm monorepo. Libraries live under
`packages/web/packages/`:

- `@agentic-web-toolkit/ui` — shadcn slot, `cn` helper, globals.
- `@agentic-web-toolkit/themes` — `ColorModeProvider`, `ThemeStyle`, themes.
- `@agentic-web-toolkit/model` — providers, hooks, lib helpers.
- `@agentic-web-toolkit/layout` — header, sidebar, breadcrumbs, app-shell CSS.
- `@agentic-web-toolkit/content` — markdown view, cards, section index.
- `@agentic-web-toolkit/controls` — settings, search, dev banner, etc.
- `@agentic-web-toolkit/chat` (under `features/chat`) — chat surfaces + backends.
- `@agentic-web-toolkit/reference-web-site` — Vite-only reference site template.

The reference demo site sits at `websites/site/` and consumes the packages
via `file:` refs (it deliberately lives **outside** the pnpm workspace so
the consumer wiring matches what external apps will use).

## Build

One-shot bootstrap (Apple xcodegen + web pnpm install):

```bash
./install.sh
```

Per-platform commands:

```bash
# Apple
open packages/apple/AgenticToolkit.xcworkspace
# Full xcodebuild commands in .claude/CLAUDE.md

# Web
cd packages/web && pnpm test
cd packages/web && pnpm build      # populates dist/ for npm publish

# Demo site
cd websites/site && npm install && npm run dev
```

## Design

How this repo is laid out and how it's consumed:
[`docs/repo-pattern.md`](docs/repo-pattern.md).

Consumer setup walkthrough (git submodule path):
[`docs/consuming-as-submodule.md`](docs/consuming-as-submodule.md).

Web-platform docs (adoption, migration, Next.js consumer wiring):
[`docs/web/`](docs/web/).

Agent-oriented orientation: [`AGENTS.md`](AGENTS.md).
Repo conventions and build rules: [`.claude/CLAUDE.md`](.claude/CLAUDE.md).
