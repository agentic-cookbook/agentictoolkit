/** The build identity a running dev server is actually serving.
 *
 *  `undefined` outside development, and `undefined` for either field it cannot
 *  read with confidence — the caller then falls back to the baked
 *  `NEXT_PUBLIC_ADH_SITE_VERSION` / `NEXT_PUBLIC_ADH_RELEASE` literals. */
export type LiveBuildIdentity = {
    version?: string;
    sha?: string;
};
/**
 * WHY THIS EXISTS AT ALL — the footer lied in development, and it lied about the
 * one question it was built to answer.
 *
 * Both halves of the footer's identity are injected by `adhNextConfig()` into
 * Next's `env`, which means they are resolved ONCE, when Next evaluates
 * `next.config.ts`. Under `next build` that moment is the build, so the baked
 * pair is exactly right and nothing here runs. Under `next dev` that moment is
 * dev-server boot, and the session then runs for hours across dozens of commits
 * while the footer keeps reporting the commit you started on. Mike: "the sites
 * version is not updating" — bumping `VERSION` moved nothing on screen, because
 * the file is not re-read until the config is re-evaluated, and `commitSha()`
 * memoises its `git rev-parse` fork at module scope on top of that.
 *
 * So in development the identity is resolved per render instead. {@link AppShell}
 * is a Server Component, so it can call this on every request and hand the result
 * to the client footer as a plain serializable prop — no per-site plumbing, no
 * client-side fetch, and 45 sites inherit it from one seam.
 *
 * DELIBERATELY NOT `@agentic-toolkit/next-env`, whose `readSiteVersion` and
 * `commitSha` own this knowledge for CONFIG evaluation. Taking that dependency
 * would add a transitive package to `@agentic-toolkit/adh`, and adh is consumed
 * by two backends through a committed `vendor/` tree whose map records what a
 * missing transitive costs there: "died with 10 `Module not found`, and neither
 * the freshness hashes nor the presence gate could see it". A dev-only convenience
 * is not worth that blast radius.
 *
 * What keeps that from being a second authority on the same knowledge is the
 * contract below, which is narrower on purpose: this can only REPLACE a value it
 * is confident about, never invent one. `next-env`'s sanitizer warns and returns
 * `""` for a malformed `VERSION`, because at config time it is the last word; here
 * a malformed file yields `undefined` and the baked value shows through unchanged.
 * The strict answer stays in one place; this is a refinement layer over it.
 *
 * WHY IT IS SERVER-ONLY, AND HOW THAT IS ENFORCED.
 * `node:fs` and `node:child_process` must never enter a client chunk. This used to say
 * the `./server` entry achieved that, because the `./layout` barrel then "carries an
 * external specifier and not these builtins". That was wrong, and it broke every site's
 * build: an external specifier is an EDGE, and the consumer's bundler follows it.
 * `app/global-error.tsx` is `'use client'` and imports the `./layout` barrel, which holds
 * AppShell, which imported `./server` — so Turbopack walked straight here and failed with
 * `Can't resolve 'child_process' / 'fs'`.
 *
 * The enforcement is now in RESOLUTION, not placement: this module is published from its
 * own `./live-build-identity` subpath, whose `browser` condition points at
 * live-build-identity-browser.ts. A client graph resolves the stub; only a server graph
 * ever reaches this file. `./server` still re-exports it for callers that want it there.
 *
 * @returns the live pair in development; `undefined` in every other mode, where
 *   the baked values are correct by construction.
 */
export declare function liveBuildIdentity(): LiveBuildIdentity | undefined;
//# sourceMappingURL=live-build-identity.d.ts.map