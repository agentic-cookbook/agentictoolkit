import { readFileSync } from "node:fs";
import path from "node:path";

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

/**
 * Sanitize and validate a `VERSION` file's raw contents before it reaches the
 * footer. `.trim()` alone let the file's bytes go straight through: `v1.0.44`
 * rendered `vv1.0.44`, `1.0` rendered `v1.0`, a multi-line file inlined a
 * newline into a JSX text node, and a UTF-8 BOM survived `.trim()` to prefix
 * the label with an invisible U+FEFF.
 *
 * Steps, in order: strip a leading BOM, take the first line only, trim, strip
 * ONE leading `v`/`V`, then require a bare semver. Anything that fails
 * validation warns — naming the raw value and the path — and returns ""
 * rather than rendering something that looks authoritative and is wrong: the
 * footer then shows the SHA alone, which reads as "this site's version file
 * is broken" instead of a confident lie.
 *
 * Ported unchanged (was module-private) from `frontend/src/next-config-base.mjs:290`.
 *
 * @param raw the file's contents, unprocessed
 * @param sourcePath absolute path, named in the warning
 * @returns a bare semver, or ""
 */
export function sanitizeVersion(raw: string, sourcePath: string): string {
  const firstLine = raw.replace(/^﻿/, "").split(/\r?\n/, 1)[0] ?? "";
  const candidate = firstLine.trim().replace(/^[vV]/, "");
  if (SEMVER_RE.test(candidate)) return candidate;
  console.warn(
    `[readSiteVersion] ${sourcePath}: VERSION content is not a bare semver ` +
      `(raw: ${JSON.stringify(raw)}) — rendering "" instead of a value that would look authoritative and be wrong.`,
  );
  return "";
}

/**
 * This site's hand-bumped version, from a `VERSION` file at the site root.
 *
 * Resolved against `siteDir`, which defaults to `process.cwd()` — the directory Next sets
 * when it evaluates `next.config.ts` — so all 45 sites can share this one read with no
 * per-site plumbing, while a caller that already knows the site's directory (e.g. a
 * registry-driven config builder) can pass it explicitly instead of depending on cwd.
 * Generalizes the bespoke `readFileSync(join(__dirname, "VERSION"))` that personaregistry
 * carried alone.
 *
 * A missing file (`ENOENT`) is the one case that degrades to "" silently, on
 * purpose — an unseeded site must still BUILD, and the footer omits the field
 * instead of rendering something broken. Anything else (EISDIR, EACCES, a
 * `TypeError` from a bad path, EMFILE under a parallel build) warns on stderr
 * instead of vanishing into the same bare "": that distinction is what would
 * have caught the `__dirname` bug fixed in `0560fd104` the moment it shipped,
 * instead of at human review. See {@link sanitizeVersion} for the
 * content-side validation.
 *
 * Ported from `frontend/src/next-config-base.mjs:320`, with one deliberate change: the
 * source always resolved against `process.cwd()` with no way to override it; this takes
 * `siteDir`, defaulting to `process.cwd()`, so every existing call behaves identically.
 *
 * @returns a bare semver ("1.0.155"), or "".
 */
export function readSiteVersion(siteDir: string = process.cwd()): string {
  const versionPath = path.join(siteDir, "VERSION");
  let raw: string;
  try {
    raw = readFileSync(versionPath, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") {
      console.warn(
        `[readSiteVersion] ${versionPath}: unexpected error reading VERSION — treating as absent.`,
        err,
      );
    }
    return "";
  }
  return sanitizeVersion(raw, versionPath);
}
