# agentic-web-toolkit

Shared React + TypeScript component library for Agentic Cookbook family
sites. Ships as a pnpm monorepo of pre-built ESM packages under the
`@agentic-toolkit/*` scope.

## Packages

Foundation — everything else builds on these:

| Package | Description | Depends on |
|---|---|---|
| `@agentic-toolkit/ui` | shadcn slot; `cn` helper, `useIsomorphicLayoutEffect`, blocks, `styles/globals.css` | — |
| `@agentic-toolkit/themes` | `ColorModeProvider`, `ThemeStyle`, theme manifest + CSS | `ui` |
| `@agentic-toolkit/model` | Providers, hooks, lib (search, breadcrumbs, nav, lookup) | — |
| `@agentic-toolkit/markdown` | Markdown rendering | `ui` |
| `@agentic-toolkit/search` | Search index + dialog | `markdown`, `ui` |
| `@agentic-toolkit/controls` | filtered-list, source-code-panel, logging-panel, user-settings, search-dialog, appearance-mode-toggle, orb-row, dev-banner | `model` |

Marketing pages — standalone; nothing here builds on it and it builds on
nothing, which is why it is its own group rather than a Foundation row:

| Package | Description | Depends on |
|---|---|---|
| `@agentic-toolkit/landing` | Scroll-snapping landing deck (`Deck`, `Screen`, `NavChrome`) plus ~20 presentational blocks. Names no colour, font or copy — every visual value reads a `--lp-*` custom property, every block takes its content as props | — |

Application platform — auth, data access, and the generated-CRUD stack:

| Package | Description | Depends on |
|---|---|---|
| `@agentic-toolkit/auth` | Session, sign-in surfaces, auth context | `ui` |
| `@agentic-toolkit/data` | Typed data access over the backend API | `auth`, `ui` |
| `@agentic-toolkit/resource` | Resource shells — list/detail scaffolding | `auth`, `data`, `ui` |
| `@agentic-toolkit/crud` | Generated CRUD surfaces | `api-explorer`, `auth`, `ui` |
| `@agentic-toolkit/api-explorer` | Interactive API explorer | `auth`, `ui` |
| `@agentic-toolkit/adh` | Family site chrome — header, footer, legal, themes, debug | `themes`, `ui` |
| `@agentic-toolkit/deploy-platform` | Deployment/tier helpers | — |

Features (`packages/features/*`) — one package per product area:

| Package | Depends on |
|---|---|
| `@agentic-toolkit/chat` | — |
| `@agentic-toolkit/bitbag` | — |
| `@agentic-toolkit/authentication` | `auth`, `data`, `resource`, `ui` |
| `@agentic-toolkit/dashboards` | `auth`, `data`, `resource`, `ui` |
| `@agentic-toolkit/ecosystems` | `auth`, `data`, `resource`, `ui` |
| `@agentic-toolkit/knowledgebases` | `auth`, `crud`, `data`, `resource`, `ui` |
| `@agentic-toolkit/narratives` | `auth`, `data`, `resource`, `ui` |
| `@agentic-toolkit/personas` | `auth`, `crud`, `data`, `resource`, `teams`, `ui` |
| `@agentic-toolkit/projects` | `auth`, `data`, `resource`, `teams`, `ui` |
| `@agentic-toolkit/research` | `auth`, `crud`, `data`, `resource`, `ui` |
| `@agentic-toolkit/teams` | `auth`, `data`, `resource`, `ui` |

Each package ships its own `dist/` with `"use client"` directives preserved,
type declarations, sourcemaps, and mirrored CSS files. Consumers do **not**
need `transpilePackages` in Next.js.

## Consumer integration

Two patterns, both Next.js 15 + React 19 + TypeScript + Tailwind v4:

- **Submodule + pnpm workspace federation** — preferred, used by Mike's own
  consumer repos. The toolkit is checked out as a submodule; the consumer
  becomes a pnpm workspace and federates `external/agentic-web-toolkit/packages/*`.
  See [`docs/web/next-js-consumer.md`](../../docs/web/next-js-consumer.md).
- **Published packages from GitHub Packages** — fallback for external
  consumers without the submodule. Same wiring on the app side; only
  install method differs.

**Existing consumers** moving off the old umbrella `file:` dependency
follow [`docs/web/migrate-consumer.md`](../../docs/web/migrate-consumer.md).

## Repo layout

Paths below are relative to the repo root, since the workspace and the
demo site deliberately sit in different trees.

```
packages/web/            # workspace root — pnpm/build config lives here
  package.json
  pnpm-workspace.yaml
  pnpm-lock.yaml
  tsconfig.base.json
  vitest.config.ts
  vitest.setup.ts
  copy-css.mjs           # only build helper, called from each package's build:css
  packages/              # libraries — zero loose files
    ui/                  # shadcn slot + blocks (components.json lives here too)
    themes/              # ColorModeProvider, ThemeStyle, theme CSS
    model/               # providers + hooks + lib
    markdown/            # markdown rendering
    search/              # search index + dialog
    controls/            # filtered-list, dev-banner, orb-row, ... (one package, many sub-exports)
    auth/ data/ resource/ crud/ api-explorer/     # application platform
    adh/                 # family site chrome (header, footer, legal, themes, debug)
    deploy-platform/     # deployment/tier helpers
    features/            # one package per product area — chat, bitbag, personas, teams, ...
websites/site/           # Next.js 15 App Router examples site
  app/                   # layout, page, [exampleId]/page
  examples/              # one self-contained example dir per control/feature
  src/manifest.ts        # registry consumed by app/page.tsx and [exampleId]/page.tsx
docs/web/                # guides, including consumer integration + migration
scripts/check_boundaries.py   # boundary guard, run by `pnpm lint`
```

The pinned pnpm files (`package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`)
must travel together — that's a pnpm constraint — but they're allowed to
live in any directory. Putting them in `packages/web/` keeps the repo root
clean and leaves room for the other platforms alongside.

`websites/site/` is **outside** the workspace and depends on the packages
through `file:` refs, so its wiring mirrors what an external consumer does
rather than what a workspace member gets for free.

## Local development

All workspace commands run from `packages/web/`:

```bash
cd packages/web
pnpm install           # workspace install
pnpm build             # pnpm -r runs each package's build script in topo order
pnpm test              # vitest across packages, root config at packages/web/vitest.config.ts
pnpm lint              # boundary guard + each package's own lint
```

The repo-root `install.sh` bootstraps a fresh checkout — it regenerates the
Apple Xcode projects and runs the workspace install here.

The demo site is not a workspace member, so it installs and runs on its own:

```bash
cd websites/site && npm install && npm run dev   # http://localhost:3000
```

Because it consumes the packages through `file:` refs, pnpm/npm **hard-copy**
the built `dist/` into its `node_modules` at install time. After rebuilding a
package, re-run `npm install` in `websites/site/` or the site keeps serving
the previous bytes.

While iterating on a package and the site together:

```bash
# In one shell — package(s) in watch mode, from packages/web/
pnpm --filter '@agentic-toolkit/chat...' run dev
# In another shell — site dev server, from websites/site/
npm run dev
```

## Tech stack

- **Packages**: React 19, TypeScript 5, tsup (esbuild) for JS, tsc for
  types, Tailwind v4 for utility CSS scanning. `"use client"` directives
  preserved via `esbuild-plugin-preserve-directives`.
- **Workspace**: pnpm 9 with the workspace root at `packages/web/`. Strict
  cross-package boundaries enforced by pnpm's resolver — undeclared
  workspace imports fail to build — plus `scripts/check_boundaries.py`,
  which bans consumer aliases (`@/…`) from every package source and stops the
  generic tier importing the adh vocabulary tier. It derives that tier from the
  packages' own `package.json` names rather than a hardcoded scope string, so a
  rename cannot silently blind it (which is exactly what retired the earlier
  literal `@adh-shared/…` ban).
- **Site**: Next.js 15 App Router, static `generateStaticParams` per
  example route.

## Tests

```bash
cd packages/web
pnpm test
```

A single vitest config at `packages/web/vitest.config.ts` discovers tests
across `packages/**`.

## Docs

- [Consumer integration (new consumers)](../../docs/web/next-js-consumer.md)
- [Migrating an existing consumer](../../docs/web/migrate-consumer.md)
- [Chat usage, layout & theming](../../docs/web/chat.md)
