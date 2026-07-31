// The client barrel. NavChrome is the package's ONLY `'use client'` module —
// it owns the drawer's open/closed state — and it is exported from here rather
// than from `src/index.ts` for a build reason, not a taste one.
//
// esbuild-plugin-preserve-directives propagates a chunk's `'use client'` to
// every entry that imports it. While NavChrome sat in the main barrel, the
// directive was hoisted onto `dist/index.js` itself, which silently turned
// every export — the deck, the screen, all nineteen blocks — into a Client
// Component: the whole page hydrated and every section's copy shipped three
// times (SSR HTML + flight payload + client bundle) on a page whose only
// interactivity is this drawer.
//
// Keeping it in its own entry, built from its own chunk graph (see
// tsup.config.ts), is what holds that line. A server-safe main barrel is a
// property of the build layout, and nothing in the type system or the tests
// can check it — `tools/check-directives.py` does.
export { NavChrome } from './chrome/NavChrome'
export type { NavChromeProps, NavLink } from './chrome/types'
