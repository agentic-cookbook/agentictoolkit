/**
 * Cache policy for the theme's self-hosted webfont faces (see materializeThemeFonts).
 *
 * `public/` assets get Next's conservative default — `public, max-age=0, must-revalidate`
 * on Vercel — which is right for a file whose contents can change under a fixed name and
 * wrong for these: the manifest carries a content revision in `publicPath`
 * (`/fonts/<rev>/iosevka-400.woff2`), so a face's bytes can never change without its URL
 * changing, which is the precondition `immutable` asks for. Without this, every repeat
 * visit spends a revalidation round trip per face BEFORE it can paint text — reintroducing,
 * for the returning visitor, the delay this whole change exists to remove for the new one.
 *
 * The path is matched by prefix rather than read from the manifest so the OLD revision's
 * URLs keep the same policy after a font bump; a browser holding the previous face has no
 * reason to be told the rules changed.
 *
 * Ported unchanged from `frontend/src/next-config-base.mjs:51`.
 */
export const FONT_CACHE_HEADERS: Array<{ key: string; value: string }> = [
  { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
];
