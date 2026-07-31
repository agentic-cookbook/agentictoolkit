// Put this package's self-hosted woff2 faces where the theme css says they are.
//
// Plain `.mjs`, deliberately: every consumer is a `next.config` — the sites' shared
// factory and the two self-enclosed backends' own configs — and a next.config cannot
// resolve `@agentic-toolkit/themes` as a bare specifier from where it sits (the sites'
// factory lives at the pnpm-workspace ROOT, which has no such dependency). What all
// three CAN do is import a real file by relative path, and this file is inside the
// package's `src/`, which is copied wholesale into each backend's `web/vendor/`. So one
// implementation reaches all of them without a resolution step. Building it through
// tsup would defeat that: `dist/` is what the vendor copy would then have to expose,
// and a next.config would be importing a bundler artifact to configure the bundler.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// This module lives in the package's `src/`, so the faces are `src/fonts/` — true in the
// package itself and in every vendored copy of it, which is the point of deriving it
// from `import.meta.url` rather than taking it as an argument.
const FONTS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "fonts");

/**
 * Copy the theme's woff2 faces into an app's `public/`, so they are served from the
 * app's OWN origin at the absolute path the theme css already names.
 *
 * The theme css is inlined into `<head>` as a string by `AdhThemeStyle`, so its
 * `src: url(…)` cannot be relative (it would resolve against the page url and break on
 * every nested route) and it cannot be bundler-resolved (there is no stylesheet for the
 * bundler to rewrite). It is absolute — `/fonts/<rev>/iosevka-400.woff2` — which means
 * the bytes have to be at that path on every app that renders the theme. `publicPath` in
 * the font manifest is the single definition of it; the css, the `<link rel=preload>`
 * and this copy all read it from there.
 *
 * Called from next.config rather than from a build script because next.config is the ONE
 * hook every app shares in every mode — `next dev`, `next build`, CI, Vercel and the
 * backends' Docker builds alike. Doing it in a build script would leave local dev with a
 * 404 for every face.
 *
 * Copies land via a temp file + rename so a dev server reading `public/` can never
 * observe a half-written font (Next may evaluate a config in more than one process), and
 * are skipped when the destination already holds the same BYTES. Byte equality, not size
 * equality: two subsets of one typeface differ by a handful of glyphs and land within a
 * few bytes of each other, so a size check is exactly the check that a re-subset can slip
 * past — and the failure mode is an app serving last week's faces with this week's
 * `@font-face` block, which nothing downstream can detect.
 *
 * Failure is FATAL. A build that cannot put these bytes in `public/` produces an app
 * whose inlined `@font-face` and `<link rel=preload>` both point at a 404: it renders in
 * the metric-matched fallback and looks nearly right, which is precisely why nobody would
 * catch it. The alternative — warn and continue — spreads that across ~45 Vercel projects
 * and two backend images, each with its own build log nobody reads on a green deploy.
 * This is `fail-fast`: the one moment the problem is cheap to see is now.
 *
 * @param {string} [appRoot] the directory holding `public/`. Defaults to `process.cwd()`,
 *   which IS the app root for every caller: `next` is always launched from the app
 *   directory (package.json scripts, build-site.py's `run(pnpm(...), cwd=SITE)`, the dev
 *   suite, and the backends' Dockerfiles all do).
 */
export function materializeThemeFonts(appRoot = process.cwd()) {
  const manifestPath = path.join(FONTS_DIR, "metrics.json");
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (err) {
    throw new Error(
      `[adh] cannot read the theme font manifest at ${manifestPath}. Every app inlines an ` +
        "@font-face block pointing into it, so a build without it ships a 404 for every " +
        "face. If the agentictoolkit submodule is not checked out, run " +
        "'git submodule update --init'.",
      { cause: err },
    );
  }
  const rel = manifest.publicPath.replace(/^\/+/, "");
  const dest = path.join(appRoot, "public", rel);
  // Its OWN try, not the face loop's: creating the directory is the likeliest failure here
  // (a read-only or full `public/`), and folding it into the loop's catch meant reporting it
  // as a failure to copy a face that had not been named yet — `cannot materialize theme font
  // undefined`, pointing every reader at the wrong half of the function.
  try {
    fs.mkdirSync(dest, { recursive: true });
  } catch (err) {
    throw new Error(
      `[adh] cannot create ${dest}. The app's inlined @font-face block names this path, so ` +
        "the build would ship a face that 404s.",
      { cause: err },
    );
  }
  for (const face of manifest.faces) {
    try {
      const bytes = fs.readFileSync(path.join(FONTS_DIR, face.file));
      const to = path.join(dest, face.file);
      let existing = null;
      try {
        existing = fs.readFileSync(to);
      } catch {
        // absent, or unreadable — either way, (re)write it below.
      }
      if (existing?.equals(bytes)) continue;
      const tmp = `${to}.${process.pid}.tmp`;
      try {
        fs.writeFileSync(tmp, bytes);
        fs.renameSync(tmp, to);
      } finally {
        // A failed write or rename leaves the temp file behind, inside the directory Next
        // is about to collect as static assets — so it would be SERVED, as a stray
        // `iosevka-400.woff2.4821.tmp`. Remove it on the way out either way.
        fs.rmSync(tmp, { force: true });
      }
    } catch (err) {
      throw new Error(
        `[adh] cannot materialize theme font ${face.file} into ${dest}. The app's inlined ` +
          "@font-face block names this path, so the build would ship a face that 404s.",
        { cause: err },
      );
    }
  }
  pruneOldRevisions(dest, rel, manifest);
}

/**
 * Delete the directories a PREVIOUS revision of the faces was copied into.
 *
 * `publicPath` carries a content hash, so re-subsetting the faces changes the directory
 * rather than the files in it — nothing ever overwrites the old copy. On the servers that
 * is invisible (every build starts from a fresh checkout and `public/fonts/` is gitignored),
 * but a working tree accumulates one ~460 KB directory per bump, across ~45 site trees and
 * both backends, and Next collects all of them as static assets — so a dev server keeps
 * serving revisions no page references, under the `immutable` header.
 *
 * The rule for "is this one of ours" is deliberately narrow: every entry in the directory
 * must be a face filename from the CURRENT manifest. Face names are revision-independent
 * (`iosevka-400.woff2`; only the parent hash moves), so a previous revision's directory is
 * always a subset — while a hand-placed `public/fonts/inter/` is not, and is left alone. It
 * fails CLOSED: an unrecognised entry, a stray `.tmp`, or a face we later rename all mean
 * "leave it", which costs disk and never costs bytes somebody needed.
 *
 * Failure here is NOT fatal, unlike everything above it. A stale directory is clutter; the
 * missing bytes this module exists to prevent are a broken page. Refusing to build because a
 * cleanup could not run would trade the cheap problem for the expensive one.
 */
function pruneOldRevisions(dest, rel, manifest) {
  // `/fonts/<rev>` — two segments. Without this a manifest that dropped the revision segment
  // would make the parent `public/` itself and put every sibling asset directory in scope.
  if (rel.split("/").filter(Boolean).length < 2) return;
  const parent = path.dirname(dest);
  const ours = new Set(manifest.faces.map((f) => f.file));
  try {
    for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
      const dir = path.join(parent, entry.name);
      if (!entry.isDirectory() || dir === dest) continue;
      const held = fs.readdirSync(dir);
      if (held.length === 0 || !held.every((name) => ours.has(name))) continue;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch {
    // See the note above: clutter is not worth failing a build over.
  }
}
