// src/layout/live-build-identity.ts
import { execFileSync } from "child_process";
import { readFileSync } from "fs";
import path from "path";
var SEMVER_RE = /^\d+\.\d+\.\d+$/;
function liveBuildIdentity() {
  if (false) return void 0;
  const siteDir = process.cwd();
  return { version: liveSiteVersion(siteDir), sha: liveCommitSha(siteDir) };
}
function liveSiteVersion(siteDir) {
  try {
    const raw = readFileSync(path.join(siteDir, "VERSION"), "utf-8");
    const candidate = (raw.replace(/^﻿/, "").split(/\r?\n/, 1)[0] ?? "").trim().replace(/^[vV]/, "");
    return SEMVER_RE.test(candidate) ? candidate : void 0;
  } catch {
    return void 0;
  }
}
function liveCommitSha(siteDir) {
  const fromCi = process.env.VERCEL_GIT_COMMIT_SHA || process.env.RAILWAY_GIT_COMMIT_SHA;
  if (fromCi) return fromCi;
  try {
    const sha = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: siteDir,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
    return sha || void 0;
  } catch {
    return void 0;
  }
}
export {
  liveBuildIdentity
};
//# sourceMappingURL=live-build-identity.js.map