import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { liveBuildIdentity } from '../live-build-identity'

/**
 * The dev-mode footer identity — the fix for "the sites version is not updating".
 *
 * The bug these pin was NOT a wrong value; it was a value that stopped moving. Both
 * halves of the footer's identity are baked into Next's `env` when `next.config.ts` is
 * evaluated, which under `next dev` happens once, at boot. So the assertions that matter
 * are about RE-READING: the first call must not decide the second's answer.
 */
describe('liveBuildIdentity', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'adh-version-'))
    vi.spyOn(process, 'cwd').mockReturnValue(dir)
    // A CI sha wins over the git fork, matching `commitSha()`'s order — stubbed here so
    // these cases assert the VERSION half without depending on whatever repo the suite
    // happens to be running inside.
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'c0ffee00deadbeef')
    vi.stubEnv('NODE_ENV', 'development')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    rmSync(dir, { recursive: true, force: true })
  })

  it('re-reads VERSION on every call, so a bump lands without restarting the server', () => {
    writeFileSync(path.join(dir, 'VERSION'), '1.0.0\n')
    expect(liveBuildIdentity()?.version).toBe('1.0.0')
    // The whole complaint in one line: this is the edit that used to change nothing on
    // screen until the dev server was restarted.
    writeFileSync(path.join(dir, 'VERSION'), '1.1.0\n')
    expect(liveBuildIdentity()?.version).toBe('1.1.0')
  })

  it('accepts the same shapes the config-time reader does — a leading v, a BOM, trailing lines', () => {
    writeFileSync(path.join(dir, 'VERSION'), '﻿v2.3.4\nnotes below\n')
    expect(liveBuildIdentity()?.version).toBe('2.3.4')
  })

  it('yields undefined rather than "" for a malformed VERSION, so the baked value shows through', () => {
    // The narrower contract that keeps this from being a second authority on the same
    // knowledge: `readSiteVersion()` warns and returns "" because at config time it has
    // the last word. Here the baked literal is still behind us, and replacing a real
    // version with a blank would be a worse answer than the stale one.
    writeFileSync(path.join(dir, 'VERSION'), '1.0\n')
    expect(liveBuildIdentity()?.version).toBeUndefined()
  })

  it('yields undefined for an absent VERSION — an unseeded site still renders a footer', () => {
    expect(liveBuildIdentity()?.version).toBeUndefined()
  })

  it('prefers a CI sha to the git fork, the same order the config-time reader uses', () => {
    expect(liveBuildIdentity()?.sha).toBe('c0ffee00deadbeef')
  })

  it('resolves the sha from git when no CI variable is set', () => {
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', '')
    vi.stubEnv('RAILWAY_GIT_COMMIT_SHA', '')
    // The tmpdir is outside any checkout, so `git rev-parse HEAD` fails there and the
    // field is dropped instead of throwing — the same degradation an absent VERSION gets.
    //
    // This also pins that the fork runs in the SITE's directory and not the server
    // process's. Inheriting the ambient cwd, this returned the toolkit repo's HEAD: a
    // real answer, to a question about a different repository from the one the version
    // came from. Passing `cwd` explicitly is what makes the two fields agree.
    expect(liveBuildIdentity()?.sha).toBeUndefined()
  })

  it('does nothing outside development, where the baked pair IS the build', () => {
    writeFileSync(path.join(dir, 'VERSION'), '1.0.0\n')
    vi.stubEnv('NODE_ENV', 'production')
    // Not `{version: undefined}` — undefined altogether, so AppShell passes no prop and
    // a production render costs neither a file read nor a process fork.
    expect(liveBuildIdentity()).toBeUndefined()
  })
})
