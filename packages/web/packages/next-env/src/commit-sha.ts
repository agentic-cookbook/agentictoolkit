import { execFileSync } from "node:child_process";

let cachedGitHeadSha: string | undefined; // see commitSha() below — memoizes only the expensive half.
let warnedEmptyCommitSha = false;

/**
 * The commit this bundle was built from.
 *
 * Unlike the version, this moves on EVERY build from any cause — including a
 * submodule bump that changed no file under the site — which is what makes the
 * pair able to answer "am I looking at what I just deployed?".
 *
 * Vercel sets VERCEL_GIT_COMMIT_SHA; Railway (the two backend web apps) sets
 * RAILWAY_GIT_COMMIT_SHA; neither exists for a local or preview build, so git
 * is the last resort. That fallback also means local builds finally tag
 * GlitchTip errors with a real release instead of omitting it.
 *
 * The `git rev-parse` fork — the expensive half — is memoized at module scope
 * (matching the `BACKEND_URL` precedent in `resolveBackendUrl`): it is a blocking
 * child-process spawn, and off Vercel it used to run again on every config
 * evaluation: dev-server boot, each `next dev` config reload, each build worker.
 * Bringing up the local suite's 45 sites paid for 45 synchronous forks of a value
 * that cannot change within a process. The env-var check here, and the file read
 * in readSiteVersion, stay per-call — both are cheap, and a bumped `VERSION`
 * should still show up on a config reload without a full process restart.
 *
 * If this resolves to "" (no CI env var and no git repo — a legitimate local
 * `docker build` rehearsal), warn once on stderr rather than staying silent:
 * the status image ships no git at all, so this is the last-resort fallback
 * with nothing behind it, and a wrong premise about `RAILWAY_GIT_COMMIT_SHA`
 * (see `20bb05228`) would otherwise blank the SHA permanently on a green build.
 *
 * Ported unchanged from `frontend/src/next-config-base.mjs:370`.
 *
 * @returns a full 40-char SHA, or "".
 */
export function commitSha(): string {
  const fromCi = process.env.VERCEL_GIT_COMMIT_SHA || process.env.RAILWAY_GIT_COMMIT_SHA;
  if (fromCi) return fromCi;
  if (cachedGitHeadSha === undefined) {
    try {
      cachedGitHeadSha = execFileSync("git", ["rev-parse", "HEAD"], {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();
    } catch {
      cachedGitHeadSha = "";
    }
  }
  if (!cachedGitHeadSha && !warnedEmptyCommitSha) {
    warnedEmptyCommitSha = true;
    console.warn(
      "[commitSha] no VERCEL_GIT_COMMIT_SHA/RAILWAY_GIT_COMMIT_SHA and `git rev-parse HEAD` " +
        "failed — NEXT_PUBLIC_ADH_RELEASE will be blank for this build.",
    );
  }
  return cachedGitHeadSha;
}
