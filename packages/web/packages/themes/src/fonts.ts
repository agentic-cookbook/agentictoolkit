// The self-hosted Iosevka faces the adh theme ships, as seen by the page that has to
// FETCH them. The `@font-face` rules themselves are emitted into the theme css by
// scripts/build-tokens.mjs; this module exists for the one thing css cannot express —
// telling the browser to start the download before it has laid anything out.
//
// Both sides read the same manifest (src/fonts/metrics.json, written by
// scripts/subset-fonts.py), so a preload can never point somewhere the css doesn't, or
// carry a filename that no longer exists.
import manifest from './fonts/metrics.json'

/**
 * Absolute, same-origin hrefs of the faces worth preloading — the ones that carry a
 * page's layout (see the `preload` flags in subset-fonts.py: all three CORE cuts,
 * italic included, because `SiteLanding`'s <h1> sets its accent word in italic above
 * the fold; never the EXT cuts, which `unicode-range` already keeps unfetched).
 *
 * A preload is only worth emitting because these are same-origin: the browser starts the
 * fetch while it is still parsing `<head>`, on the connection that delivered the html,
 * rather than after a third-party stylesheet has been fetched and parsed. That is the
 * difference between the webfont arriving before first paint and arriving after it.
 *
 * Consumed by `AdhThemeStyle` (@adh-shared/adh), which is in the `<head>` of all ~45
 * family sites. The bytes are put at these paths by `materializeThemeFonts` in
 * frontend/src/next-config-base.mjs.
 */
export const THEME_FONT_PRELOADS: readonly string[] = manifest.faces
  .filter((face) => face.preload)
  .map((face) => `${manifest.publicPath}/${face.file}`)
