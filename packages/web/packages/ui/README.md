# @agentic-cookbook/agentic-web-toolkit/ui

shadcn/ui primitives, framework-agnostic. The toolkit ships these as source — your bundler compiles them.

## What's here

- `components/` — primitives added via `npx shadcn@latest add <name>` (run from the toolkit repo root)
- `lib/utils.ts` — `cn()` helper (created by shadcn on first add)
- `hooks/` — any shadcn-provided hooks
- `styles/globals.css` — Tailwind v4 base + shadcn `:root` / `.dark` token block

## Adding primitives

From the toolkit repo root:

```sh
npx shadcn@latest add button dialog input
```

shadcn writes to `packages/ui/components/`. The `exports` map publishes them automatically — no per-component edit needed.

## Using primitives in a consumer app

The same toolkit works for both Vite and Next.js consumers. The `"use client"` directive shadcn writes is required by Next.js App Router and is a no-op under Vite.

### Vite consumer

1. Toolkit consumed via git submodule + `file:` dep (existing pattern).
2. Import the CSS once in your entry (e.g. `src/main.tsx`):
   ```ts
   import '@agentic-cookbook/agentic-web-toolkit/ui/styles/globals.css'
   import '@agentic-cookbook/agentic-web-toolkit/themes/styles/agenticcookbookweb.css'
   ```
3. `vite.config.ts` should already include `@tailwindcss/vite` — no change.
4. Use:
   ```tsx
   import { Button } from '@agentic-cookbook/agentic-web-toolkit/ui/components/button'
   ```

### Next.js consumer (App Router)

1. Add the toolkit as submodule + `file:` dep (same pattern as Vite consumers).
2. Import the CSS once in `app/layout.tsx`:
   ```ts
   import '@agentic-cookbook/agentic-web-toolkit/ui/styles/globals.css'
   import '@agentic-cookbook/agentic-web-toolkit/themes/styles/agenticcookbookweb.css'
   ```
3. Ensure your Tailwind v4 setup is wired (`@tailwindcss/postcss` in `postcss.config.mjs`).
4. Use:
   ```tsx
   import { Button } from '@agentic-cookbook/agentic-web-toolkit/ui/components/button'
   ```

## Theming

`globals.css` defines shadcn's neutral defaults on `:root` and `.dark`. The toolkit's `packages/themes/styles/*.css` override those CSS variables — pick a theme, import it after `globals.css`, and the primitives retheme without forking shadcn output.
