// The ONE home for "is this a development deployment?" — the question that decides
// whether a dev-only affordance (the site-theme switcher/editor, the site menu's dev
// tail, AppShell's animation-scale switch, the footer chat's theme store, the robots
// meta tag) exists at all. Seven modules used to spell the same env allowlist out for
// themselves, several of them carrying a comment explaining that a shared const would
// defeat Next's build-time inlining of `NEXT_PUBLIC_*`. It doesn't — the fold happens
// in THIS module and a literal `false` is what the importers see (measured: two
// production builds of a consuming site, one with the inline expression and one with
// the import, came out byte-identical). What the copies did buy was a way to add a
// fifth env, or rename one, and update only some of them — with the miss failing OPEN
// on whichever surface was forgotten and no test anywhere comparing them.
//
// The backend keeps its own copy (separate process, separate env, and no import path
// between them); adh's `backend/src/adh/test/themeSurfaceEnv.test.ts` reads THIS file and
// fails if the two lists drift. That guard now reaches ACROSS the repo boundary — this
// package lives in the agentictoolkit submodule, adh consumes it — so the test resolves
// this path through `frontend/src/external/agentictoolkit/…`, and moving or renaming this
// file is a two-repo change.
//
// It lives in adh-registry rather than in `@agentic-toolkit/adh`, where its consumers are,
// for one structural reason: adh DEPENDS on this package, so a home here can be read from
// both sides, and a home in adh could not be read from `seo/metadata.ts` at all without a
// cycle. Splitting it — one copy per package — is precisely the drift this module was
// created to end, so it stays single and crosses the boundary by export.
//
// There are two DIFFERENT reads of the same fact and they are not interchangeable:
//
//   isDevDeploymentEnv(process.env.DEPLOYMENT_ENV)  — SERVER only. DEPLOYMENT_ENV has
//     no NEXT_PUBLIC_ prefix, so it never reaches the browser. Use this to decide what
//     to RENDER (whether a <style>/<script> is emitted at all).
//
//   DEV_BUILD  — the same fact as a literal the BUNDLER can fold, for deciding what a
//     dev build DOES: which topics a menu offers, whether a helper is called. It is a
//     runtime boolean, and NOT sufficient to keep a module out of a bundle — see the
//     chunk-gate contract below.
//
// Both allowlist explicitly rather than testing `!== 'production'`, so an unset or
// misspelled env is fail-safe: the dev affordance is hidden, never shown by accident.
//
// ── The chunk-gate contract ──────────────────────────────────────────────────────────
// Keeping a module OUT of a production bundle takes more than a boolean, and the two
// missing halves are why `DEV_BUILD ? dynamic(() => import('./X'))` shipped the whole
// site-theme editor (Monaco included) into every production build of every site. The
// gates themselves live in `@agentic-toolkit/adh` (that is where the dev-only surfaces
// are); the contract is written down HERE because it is the thing every reader of
// DEV_BUILD has to know before reaching for it:
//
//   1. INLINE THE COMPARISONS AT THE import(). Webpack folds `process.env.NEXT_PUBLIC_*`
//      against a string literal while PARSING, and then walks only the branch it kept —
//      that is what stops the import() being registered at all. It cannot see through an
//      identifier, so `DEV_BUILD ?` (imported from here, or even a local const) leaves
//      the whole branch in the graph. Write the comparisons out at the gate site instead;
//      adh's productionBundleGates.test.ts checks every gate against DEV_DEPLOYMENT_ENVS.
//
//   2. IMPORT BY PACKAGE SUBPATH, not by relative path. adh's tsup builds each entry with
//      `splitting: false`, which turns a relative `import('./X')` into a lazy-init
//      wrapper around X's code INLINED into the same file — the module boundary the gate
//      needs is gone before a consumer ever sees it. A bare `@agentic-toolkit/adh/…`
//      specifier survives only if it is listed in tsup's `external` AND has its own
//      entry AND is exported from package.json; the same test checks all three.
//
// Both halves are invisible when they break: the feature keeps working in dev, nothing
// errors in production, and the only symptom is a chunk nobody looks at.

/** The deployment envs that carry dev tooling. Authoritative — anything asking
 *  "is this a dev env?" on the server should go through {@link isDevDeploymentEnv}. */
export const DEV_DEPLOYMENT_ENVS = ['local', 'testing', 'staging'] as const

export type DevDeploymentEnv = (typeof DEV_DEPLOYMENT_ENVS)[number]

/** Whether `env` names a dev deployment. Server-side read of DEPLOYMENT_ENV, which is
 *  never shipped to the client — so this decides what gets RENDERED, not what gets
 *  bundled. `local` is what the `dev.local` suite sets. */
export function isDevDeploymentEnv(env: string | null | undefined): env is DevDeploymentEnv {
  return env != null && (DEV_DEPLOYMENT_ENVS as readonly string[]).includes(env)
}

/**
 * Whether this BUILD carries dev-only client code: true in the three dev envs, false
 * in production. NEXT_PUBLIC_DEPLOYMENT_ENV is inlined per build (promoted from the
 * server-side DEPLOYMENT_ENV by `adhNextConfig()`, see @agentic-toolkit/next-config),
 * so this collapses to a literal boolean at build time. Evaluated once at module load.
 *
 * 🔑 It is written as three explicit `===` comparisons ON PURPOSE and must stay that
 * way. The bundler substitutes the `process.env.NEXT_PUBLIC_*` text and then constant-
 * folds what is left, which only works on a comparison against a string literal —
 * routing it through `DEV_DEPLOYMENT_ENVS.includes(...)` would leave a runtime array
 * lookup the folder cannot see through, so the array and every dead branch behind it
 * would survive into the production bundle. The duplication here is load-bearing; the
 * server-side list above stays the single source for every read that isn't folded.
 *
 * Foldable HERE is not foldable at an IMPORT SITE: this constant collapses inside its own
 * module, but a consumer reading `DEV_BUILD` gets an identifier, and webpack will not walk
 * past one to drop a branch. Use it for what a dev build DOES; for what a production
 * bundle CONTAINS, follow the chunk-gate contract at the top of this file.
 */
export const DEV_BUILD =
  process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === 'local' ||
  process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === 'testing' ||
  process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === 'staging'
