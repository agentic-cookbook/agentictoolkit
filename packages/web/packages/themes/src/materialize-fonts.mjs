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
  const dest = path.join(appRoot, "public", manifest.publicPath.replace(/^\/+/, ""));
  let file;
  try {
    fs.mkdirSync(dest, { recursive: true });
    for (const face of manifest.faces) {
      file = face.file;
      const bytes = fs.readFileSync(path.join(FONTS_DIR, file));
      const to = path.join(dest, file);
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
    }
  } catch (err) {
    throw new Error(
      `[adh] cannot materialize theme font ${file} into ${dest}. The app's inlined ` +
        "@font-face block names this path, so the build would ship a face that 404s.",
      { cause: err },
    );
  }
}
