# Consuming `@agentic-web-toolkit/*` from a Next.js App

The toolkit ships as a set of pre-built ESM packages under the
`@agentic-web-toolkit/*` scope. Two integration patterns are supported:

1. **Submodule + pnpm workspace federation** (primary, used by Mike's own
   consumer repos).
2. **Published packages from GitHub Packages** (fallback for external
   consumers, optional — only available once Phase 6 publishing is set up).

Both patterns expect a Next.js 15+ App Router app with React 19, TypeScript,
and Tailwind v4. The packages ship `"use client"` directives at file
granularity — Next.js does **not** need `transpilePackages` for them.

---

## Pattern A — Submodule + workspace federation (recommended)

### 1. Add the toolkit as a submodule

```bash
git submodule add https://github.com/mikefullerton/agentic-web-toolkit external/agentic-web-toolkit
```

The submodule's pinned SHA is your version lock.

### 2. Make the consumer a pnpm workspace

`pnpm-workspace.yaml` at the consumer repo root:

```yaml
packages:
  - 'app'                                        # your Next.js app
  - 'external/agentic-web-toolkit/packages/**'   # toolkit packages (covers nested groups)
```

The `**` glob is necessary because some toolkit packages live one
level deeper (`packages/features/chat`,
`packages/site-templates/reference-web-site`). pnpm filters by
`package.json` presence so this is safe.

### 3. Declare per-package deps in the app

In `app/package.json`:

```json
{
  "dependencies": {
    "@agentic-web-toolkit/chat": "workspace:*",
    "@agentic-web-toolkit/controls": "workspace:*",
    "@agentic-web-toolkit/model": "workspace:*",
    "@agentic-web-toolkit/themes": "workspace:*",
    "@agentic-web-toolkit/ui": "workspace:*"
  }
}
```

Only declare the packages you actually import.

### 4. Install once at the root

```bash
pnpm install
```

This symlinks every workspace package, including the ones inside the
submodule, into `node_modules`.

### 5. Dev loop

From the consumer repo root, run two shells — one for toolkit watch
builds, one for the Next.js dev server:

```bash
# shell 1 — toolkit packages in watch mode
pnpm -r --parallel --if-present run dev

# shell 2 — your app
pnpm --filter <your-app> dev
```

Edit a `.tsx` inside `external/agentic-web-toolkit/packages/<pkg>/src/` →
tsup rebuilds its `dist/` → Next.js hot-reloads. Same feedback latency as the
old source-direct pattern, but with real `dist/` outputs and no
per-consumer retranspilation.

### 6. Upgrading the toolkit

```bash
git -C external/agentic-web-toolkit checkout <ref>
pnpm install
```

Commit the submodule SHA bump and `pnpm-lock.yaml` together.

---

## Pattern B — Published packages

Once Phase 6 publishing is live:

```bash
npm install @agentic-web-toolkit/chat @agentic-web-toolkit/themes ...
```

Configure `.npmrc` to point the `@agentic-web-toolkit` scope at GitHub
Packages with a token that has `read:packages` (and `write:packages` for
publishing).

No submodule needed. Versions follow semver via changesets. Otherwise
identical to Pattern A from `app/layout.tsx` down.

---

## App-side wiring (both patterns)

### Root layout — `app/layout.tsx`

```tsx
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { ColorModeProvider } from '@agentic-web-toolkit/themes'
import { ThemeStyle } from '@agentic-web-toolkit/themes'
import './globals.css'

export const metadata: Metadata = {
  title: 'My App',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ColorModeProvider>
          <ThemeStyle />
          {children}
        </ColorModeProvider>
      </body>
    </html>
  )
}
```

`suppressHydrationWarning` on `<html>` is required when using
`ColorModeProvider` — it bootstraps the initial color mode from
`localStorage` before paint, which would otherwise look like a hydration
mismatch.

### Global CSS — `app/globals.css`

```css
@import 'tailwindcss';
@import '@agentic-web-toolkit/ui/styles/globals.css';
@import '@agentic-web-toolkit/themes/styles/agentic-cookbook.css';

/* Pattern A (submodule) — scan toolkit's built dist for utility classes */
@source "../../external/agentic-web-toolkit/packages/*/dist/**/*.{js,d.ts}";

/* Pattern B (published) — scan node_modules instead */
/* @source "../node_modules/@agentic-web-toolkit/*/dist/**/*.{js,d.ts}"; */
```

Pick one `@source` directive depending on which integration pattern you're
using. Tailwind v4 scans the **built** output (not source) so the
JIT sees every utility class the library's compiled JSX emits.

### PostCSS — `postcss.config.mjs`

```js
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

### `next.config.ts`

```ts
import type { NextConfig } from 'next'

const config: NextConfig = {
  reactStrictMode: true,
  // No transpilePackages — toolkit packages ship pre-built ESM.
}

export default config
```

If you're deploying to a sub-path on GitHub Pages, add `output: 'export'`,
`basePath: '/your-base'`, `trailingSlash: true`, and
`images: { unoptimized: true }`.

---

## Importing components

All public surfaces are named exports from per-package root or sub-path
entries:

```tsx
'use client'
import { InlineChat, FetchBackend } from '@agentic-web-toolkit/chat'
import { FilteredList } from '@agentic-web-toolkit/controls/filtered-list'
import { useColorMode } from '@agentic-web-toolkit/themes'
import { ContentProvider } from '@agentic-web-toolkit/model'
```

Most toolkit components carry their own `"use client"` directive — you don't
need to add one to a Server Component just because it renders a toolkit
component. You only need `"use client"` on **your** components when they use
hooks or browser-only APIs.

---

## Common pitfalls

- **Don't `npm install` inside a build script.** A chained shell like
  `cd … && npm install && cd … && npm run build` will leak orphan node
  processes if the build is killed mid-flight. Install once at the
  workspace root; let `pnpm -r` orchestrate the rest.
- **Don't set `transpilePackages`** for `@agentic-web-toolkit/*`. The
  packages already ship as Next-compatible ESM with directives preserved;
  re-transpiling them strips those directives and breaks SSR.
- **CSS imports must hit the package's exported `styles/*.css` paths**, not
  internal `dist/...` paths. Each package's `exports` map names what's
  public.
- **For `output: 'export'`**, all dynamic routes need `generateStaticParams`
  + `export const dynamicParams = false`. This is a Next.js requirement, not
  a toolkit one.
