import type { LiveBuildIdentity } from './live-build-identity'

/**
 * The `browser`-condition twin of {@link ./live-build-identity}, and the reason that
 * module's server-only promise is now enforced by RESOLUTION rather than by placement.
 *
 * The original argument was that `node:fs` / `node:child_process` stay out of the client
 * chunk because the module is published from `./server` and imported by that package
 * path, so the `./layout` barrel "carries an external specifier and not these builtins".
 * The specifier half is true; the conclusion does not follow. An external specifier is
 * still an EDGE, and the consuming site's bundler follows it. Every site's
 * `app/global-error.tsx` is `'use client'` and imports `GlobalError` from
 * `@agentic-toolkit/adh/layout`; that barrel is one `bundle: true, splitting: false` file
 * that also holds AppShell, whose import of `./server` Turbopack duly resolved and walked,
 * straight into the two builtins:
 *
 *     Module not found: Can't resolve 'child_process'   dist/server.js:226
 *     Module not found: Can't resolve 'fs'              dist/server.js:227
 *
 * Placement cannot fix that, because the client graph's entry is not this module and never
 * was — it is the barrel, and the barrel has no way to not contain AppShell. What does fix
 * it is telling the resolver what to hand back when it arrives here from a client bundle,
 * which is what the `browser` condition on the `./live-build-identity` subpath does: the
 * server graph resolves the real module, a client graph resolves this one, and the builtins
 * have no edge into the client bundle left to follow.
 *
 * Returning `undefined` is not a degradation. The real implementation's first line is
 * `if (process.env.NODE_ENV !== 'development') return undefined`, and it is called from a
 * Server Component that hands the result to the client footer as a plain serializable prop
 * — so no client bundle has ever had a reason to call this, in any mode. `undefined` is the
 * documented value for "cannot read it with confidence", and the footer's fallback to the
 * baked `NEXT_PUBLIC_ADH_SITE_VERSION` / `NEXT_PUBLIC_ADH_RELEASE` pair is what a client
 * caller would want anyway.
 */
export function liveBuildIdentity(): LiveBuildIdentity | undefined {
  return undefined
}

export type { LiveBuildIdentity }
