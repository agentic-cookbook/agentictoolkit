# agentic-web-toolkit

Shared React + TypeScript component library for Agentic Cookbook family
sites. Ships as a pnpm monorepo with eight pre-built ESM packages under
the `@agentic-web-toolkit/*` scope.

## Packages

| Package | Description | Depends on |
|---|---|---|
| `@agentic-web-toolkit/ui` | shadcn slot; `cn` helper, `useIsomorphicLayoutEffect`, `styles/globals.css` | — |
| `@agentic-web-toolkit/themes` | `ColorModeProvider`, `ThemeStyle`, theme manifest + CSS | `ui` |
| `@agentic-web-toolkit/model` | Providers, hooks, lib (search, breadcrumbs, nav, lookup) | — |
| `@agentic-web-toolkit/layout` | CSS bundles (header, sidebar, breadcrumbs, toc, app-shell) | — |
| `@agentic-web-toolkit/content` | Markdown view, cards, home page, section index | `model` |
| `@agentic-web-toolkit/controls` | filtered-list, source-code-panel, logging-panel, user-settings, search-dialog, appearance-mode-toggle, orb-row, dev-banner | `model`, `themes` |
| `@agentic-web-toolkit/chat` | InlineChat, ThreePaneChat, MobileChat, PersonaChat, backends, hooks | — |
| `@agentic-web-toolkit/reference-web-site` | Vite-only reference site template with its own plugin | `controls`, `model`, `themes` |

Each package ships its own `dist/` with `"use client"` directives preserved,
type declarations, sourcemaps, and mirrored CSS files. Consumers do **not**
need `transpilePackages` in Next.js.

## Consumer integration

Two patterns, both Next.js 15 + React 19 + TypeScript + Tailwind v4:

- **Submodule + pnpm workspace federation** — preferred, used by Mike's own
  consumer repos. The toolkit is checked out as a submodule; the consumer
  becomes a pnpm workspace and federates `external/agentic-web-toolkit/packages/*`.
  See [`docs/next-js-consumer.md`](docs/next-js-consumer.md).
- **Published packages from GitHub Packages** — fallback for external
  consumers without the submodule. Same wiring on the app side; only
  install method differs.

**Existing consumers** moving off the old umbrella `file:` dependency
follow [`docs/migrate-consumer.md`](docs/migrate-consumer.md).

## Repo layout

```
packaging/               # workspace root — pnpm/build config lives here
  package.json
  pnpm-workspace.yaml
  pnpm-lock.yaml
  tsconfig.base.json
  vitest.config.ts
  vitest.setup.ts
  copy-css.mjs           # only build helper, called from each package's build:css
packages/                # libraries — zero loose files
  ui/                    # shadcn slot (components.json lives here too)
  themes/                # ColorModeProvider, ThemeStyle, theme CSS
  model/                 # providers + hooks + lib
  layout/                # layout CSS bundles
  content/               # markdown + cards + home/section index
  controls/              # filtered-list, dev-banner, orb-row, ... (one package, many sub-exports)
  features/
    chat/                # InlineChat / ThreePaneChat / MobileChat / PersonaChat
  site-templates/
    reference-web-site/  # Vite-only template + plugin
site/                    # Next.js 15 App Router examples site (deployed to GitHub Pages)
  app/                   # layout, page, [exampleId]/page
  examples/              # one self-contained example dir per control/feature
  src/manifest.ts        # registry consumed by app/page.tsx and [exampleId]/page.tsx
docs/                    # guides, including consumer integration + migration
```

The pinned pnpm files (`package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`)
must travel together — that's a pnpm constraint — but they're allowed to
live in any directory. Putting them in `packaging/` keeps the repo root
clean.

## Local development

All workspace commands run from `packaging/`:

```bash
cd packaging
pnpm install           # workspace install (federates ../packages/* and ../site)
pnpm build             # pnpm -r runs each package's build script in topo order
pnpm test              # vitest across packages, root config at packaging/vitest.config.ts
pnpm --filter agentic-web-toolkit-site dev   # Next.js dev at http://localhost:3000/agentic-web-toolkit/
```

The repo-root `install.sh` and `uninstall.sh` are thin wrappers that
`cd packaging && pnpm install` for fresh checkouts.

While iterating on a package and the site together:

```bash
# In one shell — package(s) in watch mode
pnpm --filter '@agentic-web-toolkit/chat...' run dev
# In another shell — site dev server
pnpm --filter agentic-web-toolkit-site dev
```

`pnpm --filter agentic-web-toolkit-site build` produces a static export
under `site/out/`.

## Tech stack

- **Packages**: React 19, TypeScript 5, tsup (esbuild) for JS, tsc for
  types, Tailwind v4 for utility CSS scanning. `"use client"` directives
  preserved via `esbuild-plugin-preserve-directives`.
- **Workspace**: pnpm 9 with the workspace root at `packaging/`. Strict
  cross-package boundaries enforced by pnpm's resolver — undeclared
  workspace imports fail to build.
- **Site**: Next.js 15 App Router, `output: 'export'`, static
  `generateStaticParams` per example route.

## Tests

```bash
cd packaging
pnpm test
```

A single vitest config at `packaging/vitest.config.ts` discovers tests
across `../packages/**`.

## Docs

- [Consumer integration (new consumers)](docs/next-js-consumer.md)
- [Migrating an existing consumer](docs/migrate-consumer.md)
- [Chat usage, layout & theming](docs/chat.md)
