# Monorepo Conversion (May 2026)

This doc records the conversion of `agentic-web-toolkit` from a single
raw-TypeScript package shipped via `file:` dependency into a pnpm
monorepo with eight pre-built ESM packages plus a Next.js 15 examples
site. It captures what shipped, *why* it shipped that way, and what
was intentionally deferred.

> **Note (post-conversion update):** the conversion originally shipped
> with turborepo as the workspace runner. A subsequent cleanup
> consolidated all workspace-root files into a `packaging/` directory
> at the repo root; turborepo was dropped at that point because it
> refused workspace members outside its config dir, and `pnpm -r`
> proved sufficient at this scale. See "Layout cleanup" below.

For day-to-day usage, prefer:

- **New consumers** → [`next-js-consumer.md`](next-js-consumer.md)
- **Migrating existing consumers** → [`migrate-consumer.md`](migrate-consumer.md)

This doc is the *historical* and *architectural* record.

---

## What the toolkit ships now

Eight packages under the `@agentic-toolkit/*` scope, each built to
its own `dist/` and published-or-federated via pnpm workspaces:

| Package                                  | Depends on                | Notes                                            |
| ---------------------------------------- | ------------------------- | ------------------------------------------------ |
| `@agentic-toolkit/ui`                | —                         | shadcn slot; `cn`, `useIsomorphicLayoutEffect`, `styles/globals.css` |
| `@agentic-toolkit/themes`            | `ui`                      | `ColorModeProvider`, `ThemeStyle`, theme manifest + CSS |
| `@agentic-toolkit/model`             | —                         | Providers, hooks, search/breadcrumbs/nav/lookup  |
| `@agentic-toolkit/layout`            | —                         | Layout CSS bundles                               |
| `@agentic-toolkit/content`           | `model`                   | Markdown view, cards, home, section index        |
| `@agentic-toolkit/controls`          | `model`, `themes`         | One package, per-control sub-exports             |
| `@agentic-toolkit/chat`              | —                         | InlineChat / ThreePaneChat / MobileChat / PersonaChat |
| `@agentic-toolkit/reference-web-site`| `controls`, `model`, `themes` | Vite-only template + plugin                  |

Plus the examples site at `site/` — **Next.js 15 App Router**, static
export, deployed to GitHub Pages.

## Why this shape

Two problems forced the same conversion:

1. **The library shipped raw TypeScript.** Consumer bundlers
   retranspiled the entire library on every build. In one consumer
   workspace this combined with a chained-shell `npm run build` to
   leak hundreds of orphan `node` processes when builds were killed
   mid-flight. Real `dist/` outputs + a workspace runner with proper
   signal forwarding (`pnpm -r`, originally turborepo) is the
   structural fix.
2. **All consumer sites are moving to Next.js 15 + React 19.** The
   library needed `"use client"` boundaries preserved through bundling,
   SSR-safe layout effects, no required `react-router` peer at the
   root, and one clear installation story. Grafting this onto a no-build
   distribution was not viable.

## Key decisions

### Submodule pattern preserved

Consumers still git-submodule the toolkit. The *only* consumer-side
change is adding `external/agentic-web-toolkit/packages/**` to
`pnpm-workspace.yaml` and switching deps to `"@agentic-toolkit/<pkg>": "workspace:*"`.
Version lock is still the submodule SHA. The `**` glob covers the
nested groups (`packages/features/*`,
`packages/site-templates/*`); pnpm filters by `package.json` presence
so it's safe.

### One `controls` package, many sub-exports

Splitting controls per-package would have added ceremony without
buying anything. Cross-control sharing (the appearance-mode-toggle ↔
theme bus) is non-trivial. Each control gets a barrel sub-export
(`@agentic-toolkit/controls/filtered-list`) so consumers still
only pay for what they import.

### `"use client"` directive preservation

`tsup` with `esbuild-plugin-preserve-directives` keeps the directive on
each client file in `dist/`. Verified by
`grep -rn '"use client"' packages/*/dist/` after every build — every
client `.tsx` in `src/` produces exactly one hit. Without this, every
client component would re-evaluate as a Server Component in Next.js
and break with "you're importing a component that needs useEffect"
errors.

### Strict workspace boundaries

pnpm's strict resolver refuses undeclared cross-package imports.
Library packages may **only** depend on other packages under
`packages/*` — never on `/src/` (which no longer exists) or any
non-packages location. This is the safety net that catches forgotten
relative imports during refactors. There is an auto-memory entry
enforcing this: see `feedback_packages_dependency_boundary`.

### Tailwind v4 scans `dist/`, not source

Consumers point Tailwind v4's `@source` directive at
`external/agentic-web-toolkit/packages/*/dist/**/*.{js,d.ts}` (or
`node_modules/@agentic-toolkit/*/dist/**` for published consumers).
The JIT sees what the library's *compiled* JSX actually renders.

### No `transpilePackages` in Next.js

The packages ship pre-built Next.js-compatible ESM with directives
intact. Re-transpiling them would strip the directives.

### The RSC client-reference transform strips non-component named exports

Discovered during the site migration: example modules carrying
`"use client"` cannot expose a `meta` named export to the manifest —
Next.js's transform replaces non-component named exports on client
modules with client-reference stubs that don't carry the original
data. The manifest at `site/src/manifest.ts` therefore hard-codes
`id`/`label` rather than spreading `Mod.meta`. Worth knowing if you
ever consider per-example metadata co-located with components.

### `reference-web-site` stays Vite-only

It's a template + plugin, not a runtime library. Excluded from the
Next.js gallery (moved to `site/examples/_disabled/`). Re-enabling it
as a Next.js-shaped template is its own scope.

## Verification done

- `pnpm build` (from `packaging/`) runs clean across all eight
  library packages plus the site.
- `pnpm test` green across the test-bearing packages.
- `pnpm --filter agentic-web-toolkit-site build` produces 16 static
  pages (12 examples + index + 404) under `site/out/`.
- Visual verification: headless Chrome screenshots of `/`, `/chat/`,
  `/filtered-list/`, `/user-settings/` confirmed correct rendering
  with theme tokens applied.
- Cross-package import discipline: zero relative `../../../...`
  cross-package imports remain in any package's `src/`.

## Deferred / out of scope

- **Phase 6: changesets release to GitHub Packages.** Optional.
  Submodule + workspace federation covers Mike's own consumers fully.
  Lift this when an external consumer without the submodule needs it.
- **Per-package vitest configs.** Mechanical follow-up; tests pass on
  the shared root preset.
- **Component-by-component shadcn rewrites.** The `ui` slot is staged
  but no individual control has been rewritten on top of shadcn
  primitives yet.
- **Next.js variant of the `reference-web-site` template.**
- **External-consumer migrations.** Each consumer (`apps/temporal/web/*`,
  `agenticregistry/web/app`, etc.) follows `migrate-consumer.md`
  independently. None are migrated as part of the toolkit conversion.

## Repo layout (post-conversion, post-cleanup)

```
packaging/               # workspace root — pnpm/build config lives here
  package.json
  pnpm-workspace.yaml
  pnpm-lock.yaml
  tsconfig.base.json
  vitest.config.ts
  vitest.setup.ts
  copy-css.mjs           # only surviving helper
packages/                # libraries — zero loose files
  ui/                    # shadcn slot (components.json co-located)
  themes/                # ColorModeProvider, ThemeStyle, theme CSS
  model/                 # providers + hooks + lib
  layout/                # layout CSS bundles
  content/               # markdown + cards + home/section index
  controls/              # filtered-list, dev-banner, orb-row, ... (one package, many sub-exports)
  features/
    chat/                # InlineChat / ThreePaneChat / MobileChat / PersonaChat
  site-templates/
    reference-web-site/  # Vite-only template + plugin
site/                    # Next.js 15 App Router examples site
  app/                   # layout, page, [exampleId]/page
  examples/              # one self-contained example dir per control/feature
  src/manifest.ts        # registry (hard-coded ids/labels + default-component imports)
docs/
  README.md              # index
  adoption.md            # decision + runaway-node-process cautions
  next-js-consumer.md
  migrate-consumer.md
  monorepo-conversion.md (this file)
  chat.md                # chat package usage + theming + message layout
  archive/plans/         # completed implementation plans
```

## Layout cleanup (post-conversion)

The original conversion left workspace-root files (`package.json`,
`pnpm-workspace.yaml`, `pnpm-lock.yaml`, `turbo.json`,
`tsconfig.base.json`, `vitest.config.ts`, `vitest.setup.ts`) and a
`scripts/` directory sitting next to the library subdirs inside
`packages/`. A subsequent cleanup pulled all of those into a new
`packaging/` directory at the repo root, leaving `packages/` to
contain only library subdirs. Three dead scripts were dropped:
`add-use-client.py` (superseded by `esbuild-plugin-preserve-directives`),
`esbuild-inline-css.mjs` (never wired up), and
`rewrite-site-imports.py` (one-shot codemod from the conversion).

Turborepo was dropped at the same time. Turbo refused to discover
workspace members located outside its own config directory (e.g.
`../packages/site-templates/reference-web-site/`), which conflicted
with the encapsulation goal. The root scripts were rewritten as
`pnpm -r run <task>`; cache-on-rebuild was lost, but at eight packages
the wall-clock cost is small. Re-introducing turbo (or nx) is on the
table if rebuild times become a problem.

A repo-root symlink `node_modules → packaging/node_modules` lets
library packages at `packages/<name>/` resolve hoisted devDeps (tsup,
typescript) by walking up the filesystem — `packaging/` is a sibling,
not an ancestor, so the symlink is what makes node module resolution
reach it.

Consumers that already use the `external/agentic-web-toolkit/packages/*`
glob keep working only if no toolkit package they import lives under
`features/` or `site-templates/`. The safe glob going forward is
`external/agentic-web-toolkit/packages/**` (pnpm filters by
`package.json` presence).

## See also

- PR #8 — squash-merged as `3557a37` — full diff and commit-by-commit
  history of the conversion.
- The original implementation plan at
  `~/.claude/plans/composed-tumbling-lovelace.md` — phased plan with
  per-gate verification criteria that the implementation followed.
