# Migrating an Existing Consumer to the New Toolkit Shape

This is the checklist for moving an existing consumer repo off the old
umbrella `file:` dependency pattern onto the new per-package
`workspace:*` pattern.

Old pattern (going away):

```json
"@agentic-cookbook/agentic-web-toolkit": "file:../external/agentic-web-toolkit"
```

New pattern (this doc):

```json
"@agentic-toolkit/chat": "workspace:*",
"@agentic-toolkit/themes": "workspace:*"
```

The submodule itself stays. Only how you reference packages inside it
changes. Each consumer migration is independent — the toolkit's submodule
SHA is unchanged by these edits.

---

## 8-step checklist

### 1. Install pnpm

```bash
npm i -g pnpm@9
```

Delete the consumer's `package-lock.json`. On the first `pnpm install`,
a `pnpm-lock.yaml` will be generated — commit it.

### 2. Add `pnpm-workspace.yaml` at the consumer root

```yaml
packages:
  - 'app'                                         # your existing Next.js app dir(s)
  - 'admin'                                       # if you have multiple apps
  - 'external/agentic-web-toolkit/packages/**'    # toolkit packages (covers nested groups)
```

Adjust the first entries to match your repo's app layout. The `**` glob
is necessary because some toolkit packages live one level deeper
(`packages/features/chat`, `packages/features/personas`, …). pnpm filters
by `package.json` presence so this is safe.

### 3. Swap the dep in the consumer's `package.json`

Remove:

```json
"@agentic-cookbook/agentic-web-toolkit": "file:../external/agentic-web-toolkit"
```

Add only the packages you actually import. A typical consumer needs some
subset of:

```json
{
  "dependencies": {
    "@agentic-toolkit/chat": "workspace:*",
    "@agentic-toolkit/controls": "workspace:*",
    "@agentic-toolkit/model": "workspace:*",
    "@agentic-toolkit/themes": "workspace:*",
    "@agentic-toolkit/ui": "workspace:*"
  }
}
```

If you have multiple apps in the consumer repo (`app/`, `admin/`), each
gets its own `package.json` with its own subset.

### 4. Rewrite imports across the consumer's source

Per-package mapping from the old umbrella sub-paths to the new package
roots:

| Old import path                                           | New import path                                         |
| --------------------------------------------------------- | ------------------------------------------------------- |
| `@agentic-cookbook/agentic-web-toolkit/themes/...`        | `@agentic-toolkit/themes/...`                       |
| `@agentic-cookbook/agentic-web-toolkit/model/...`         | `@agentic-toolkit/model/...`                        |
| `@agentic-cookbook/agentic-web-toolkit/controls/<ctrl>`   | `@agentic-toolkit/controls/<ctrl>`                  |
| `@agentic-cookbook/agentic-web-toolkit/features/chat/...` | `@agentic-toolkit/chat/...`                         |

Three of the old umbrella sub-paths have **no successor** — `layout/…`,
`content/…`, and `site-templates/reference-web-site/…` were deleted in July
2026 once nothing imported them. If your repo still imports one of them:

- the document-reading UI they were used for (nav tree, breadcrumbs, ToC,
  prose, metadata) now lives in `@agentic-toolkit/ui/blocks` as the **HDV**
  (Hierarchical Document View) family, which is a re-extraction rather than
  a rename — the props differ, so this is a port, not a `sed`;
- everything else in those packages was `awt-*` BEM CSS that the family
  replaced with Tailwind over `--color-*` tokens. Restyle against the
  tokens in `@agentic-toolkit/themes` rather than reviving the CSS.

A codemod-grade `sed` per row (one rule per package) handles most repos.
For a one-shot transform, the row mapping above is enough to drive a
small Python script — iterate every tracked `.ts`/`.tsx`/`.css` file
under the consumer, apply each `from → to` substitution literally, and
commit the result.

### 5. Update Tailwind config to scan `dist/`, not source

In your consumer's Tailwind v4 CSS entry (replaces any v3 `content:` config):

```css
@import 'tailwindcss';

@source "../external/agentic-web-toolkit/packages/*/dist/**/*.{js,d.ts}";
```

Adjust the relative path to wherever your CSS entry lives. Tailwind v4
needs to see the **built** JS/d.ts of each package — that's what the
runtime renders.

### 6. Remove `transpilePackages` from `next.config.ts`

If your consumer had:

```ts
transpilePackages: ['@agentic-cookbook/agentic-web-toolkit']
```

Delete it. Toolkit packages now ship pre-built ESM with `"use client"`
directives preserved; Next.js does not need to retranspile them.

### 7. Excise chained-shell `npm install` from build scripts

If any `package.json` script reads like:

```json
"build": "cd ../external/agentic-web-toolkit && npm install && cd ../../app && npm install && npm run build"
```

Rewrite it as a single workspace-root command:

```json
"build": "pnpm -r build"
```

This is the structural fix for the orphan-process incident class. **Never
nest `npm install` inside a build.**

### 8. First-time install + dev

From the consumer repo root:

```bash
pnpm install
pnpm dev
```

Expected:

- pnpm symlinks every workspace package, including the toolkit's, into
  `node_modules`.
- Toolkit's `dist/` directories build (per-package watch).
- Next.js dev server boots; every page renders with toolkit components.
- Editing a `.tsx` in the toolkit submodule triggers a watch rebuild and
  Next.js HMR.

Commit the new `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and the edits to
`package.json` / `next.config.ts` / Tailwind CSS entry in one logical
commit per app.

---

## Rollback

The toolkit's submodule SHA isn't touched by this migration, so the
escape hatch is purely consumer-side: `git revert` the migration commit,
restore `package-lock.json`, `npm install`. Nothing in the submodule
needs to change.

## See also

- `docs/next-js-consumer.md` — full integration guide for new consumers.
