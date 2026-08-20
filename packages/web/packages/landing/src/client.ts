// The client barrel: every module in this package that carries `'use client'`,
// and nothing else. It is a separate entry from `src/index.ts` for a build
// reason, not a taste one.
//
// esbuild-plugin-preserve-directives propagates a chunk's `'use client'` to
// every entry that imports it. While `NavChrome` sat in the main barrel, the
// directive was hoisted onto `dist/index.js` itself, which silently turned
// every export — the deck, the screen, all nineteen blocks — into a Client
// Component: the whole page hydrated and every section's copy shipped three
// times (SSR HTML + flight payload + client bundle) on a page whose only
// interactivity is a drawer.
//
// Keeping the client modules in their own entry, built from their own chunk
// graph (see tsup.config.ts), is what holds that line. A server-safe main
// barrel is a property of the build layout, and nothing in the type system or
// the tests can check it — `tools/check-directives.py` does.
export { NavChrome } from './chrome/NavChrome'
export type { NavChromeProps, NavLink } from './chrome/types'
export { Clip, usePrefersReducedMotion } from './blocks/Clip'
export type { ClipProps } from './blocks/Clip'
export { SiteHeader } from './flow/SiteHeader'
export type { SiteHeaderProps } from './flow/SiteHeader'
export { Reveal } from './flow/Reveal'
