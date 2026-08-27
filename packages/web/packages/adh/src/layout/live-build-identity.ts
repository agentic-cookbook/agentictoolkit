import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

/** The build identity a running dev server is actually serving.
 *
 *  `undefined` outside development, and `undefined` for either field it cannot
 *  read with confidence — the caller then falls back to the baked
 *  `NEXT_PUBLIC_ADH_SITE_VERSION` / `NEXT_PUBLIC_ADH_RELEASE` literals. */
export type LiveBuildIdentity = { version?: string; sha?: string }

const SEMVER_RE = /^\d+\.\d+\.\d+$/

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
 * WHY IT IS SERVER-ONLY, AND WHY IT IS REACHED THROUGH `@agentic-toolkit/adh/server`.
 * `node:fs` and `node:child_process` must never enter a client chunk. This module
 * is published from the `./server` entry and imported by that package path, so the
 * `./layout` barrel — which client components do import — carries an external
 * specifier and not these builtins.
 *
 * @returns the live pair in development; `undefined` in every other mode, where
 *   the baked values are correct by construction.
 */
export function liveBuildIdentity(): LiveBuildIdentity | undefined {
  if (process.env.NODE_ENV !== 'development') return undefined
  // Both halves anchored to the SAME directory, read once and passed down rather than
  // called twice. `process.cwd()` is the site's own directory — the anchor
  // `readSiteVersion()` defaults to, which is what makes this agree with the baked value
  // instead of resolving some other site's file.
  const siteDir = process.cwd()
  return { version: liveSiteVersion(siteDir), sha: liveCommitSha(siteDir) }
}

/** `<siteDir>/VERSION`, re-read every call — the memo IS the bug in this mode. */
function liveSiteVersion(siteDir: string): string | undefined {
  try {
    const raw = readFileSync(path.join(siteDir, 'VERSION'), 'utf-8')
    const candidate = (raw.replace(/^﻿/, '').split(/\r?\n/, 1)[0] ?? '').trim().replace(/^[vV]/, '')
    return SEMVER_RE.test(candidate) ? candidate : undefined
  } catch {
    return undefined
  }
}

/** `git rev-parse HEAD`, NOT memoised — the memo is precisely the bug in this mode.
 *
 *  A CI env var wins where one exists, matching `commitSha()`'s order, so a dev
 *  server started inside a Vercel/Railway shell still reports that build's commit.
 *  The fork costs a few milliseconds per render and only ever happens in dev.
 *
 *  `cwd` is passed EXPLICITLY rather than inherited. A child process gets the real
 *  process cwd, which is not necessarily the directory the version was read from —
 *  and a site living inside a submodule would then be stamped with the OUTER repo's
 *  HEAD, so the two fields would answer about two different repositories. */
function liveCommitSha(siteDir: string): string | undefined {
  const fromCi = process.env.VERCEL_GIT_COMMIT_SHA || process.env.RAILWAY_GIT_COMMIT_SHA
  if (fromCi) return fromCi
  try {
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: siteDir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return sha || undefined
  } catch {
    return undefined
  }
}
