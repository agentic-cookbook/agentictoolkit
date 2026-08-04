// Single source of truth for the dev-only adh theme preview: the cookie name, the
// cross-subdomain cookie-domain rule, the cookie/localStorage read+write, the
// cross-site carry, the alt-block activation, and the pre-paint bootstrap. Consumed
// by the settings Appearance panel's theme picker, the theme editor, the header
// SiteSwitcher (cross-site carry), DbThemeApplier, and AdhThemeStyle (the pre-paint
// <script>). Keeping it in one file stops the read/write/domain/activation logic from
// drifting between those call sites — the pre-paint below re-implements all of it as a
// string, and a mirror is only maintainable next to the thing it mirrors.

import { DEFAULT_SITE_THEME } from './adh-themes'

export const THEME_STORAGE_KEY = 'adh-theme'

// AdhThemeStyle emits one `<style data-adh-theme-alt="…">` per theme ONLY in the
// switcher envs (local/staging/testing); their presence is the gate for the
// switcher (the env check lives server-side, so DEPLOYMENT_ENV never ships to the
// client). Switching = flipping the chosen block's `media` to "all".
export const ALT_STYLE_SELECTOR = 'style[data-adh-theme-alt]'

/** Activate a baked theme by flipping its alt-block to `media="all"` and every other
 *  block back to `media="not all"` — the whole of what "switching theme" means at
 *  runtime. No-op on the server / in production, where no alt-blocks are emitted.
 *
 *  Lives beside {@link themePrePaintScript}, which does this same flip in string form
 *  before hydration, and beside ALT_STYLE_SELECTOR, which names the nodes both touch:
 *  the pre-paint's mirror of this logic is only safe while the thing being mirrored is
 *  in the same file. Callers that also want the choice REMEMBERED pair it with
 *  {@link persistTheme}; the theme editor deliberately does not (its live override is
 *  in-session), which is why the two stay separate functions. */
export function applyBaseTheme(seedKey: string): void {
  if (typeof document === 'undefined') return
  document.querySelectorAll<HTMLStyleElement>(ALT_STYLE_SELECTOR).forEach((el) => {
    el.media = el.getAttribute('data-adh-theme-alt') === seedKey ? 'all' : 'not all'
  })
}

// The choice lives in a cookie scoped to the registrable domain so it carries
// across the family's subdomains (e.g. picking on the hub also themes status.*).
// localStorage is a same-origin fallback. Cross-apex isn't shared.
export function cookieDomain(): string {
  const h = location.hostname
  if (h === 'localhost' || h.endsWith('.localhost')) return 'localhost'
  const parts = h.split('.')
  return parts.length <= 2 ? h : parts.slice(-2).join('.')
}

export function readStoredTheme(): string | null {
  const m = document.cookie.match(/(?:^|; )adh-theme=([^;]+)/)
  if (m?.[1]) return decodeURIComponent(m[1])
  try {
    return localStorage.getItem(THEME_STORAGE_KEY)
  } catch {
    return null
  }
}

export function persistTheme(id: string): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id)
  } catch {
    /* blocked storage — the cookie + in-page swap still work */
  }
  try {
    document.cookie = `${THEME_STORAGE_KEY}=${id};domain=${cookieDomain()};path=/;max-age=31536000;samesite=lax`
  } catch {
    /* ignore */
  }
}

/** The previewed theme to carry across a cross-site hop — null in production / SSR
 *  (no alt-theme blocks present) so callers stay inert there. */
export function readPreviewTheme(): string | null {
  if (typeof document === 'undefined') return null
  if (!document.querySelector(ALT_STYLE_SELECTOR)) return null
  return readStoredTheme()
}

/** Tag a CROSS-SITE destination href with the previewed theme as a `#adh-theme=…`
 *  fragment so the target applies it on arrival. No-op for non-http (same-origin)
 *  hrefs; preserves a destination's own fragment; refreshes a stale adh-theme one. */
export function appendThemePreview(href: string, theme: string | null): string {
  if (!theme || !href.startsWith('http')) return href
  try {
    const u = new URL(href)
    if (u.hash && !u.hash.startsWith('#adh-theme=')) return href // keep a real fragment
    u.hash = `adh-theme=${theme}`
    return u.toString()
  } catch {
    return href
  }
}

// The pre-paint bootstrap — an IIFE string for an inline <script> that applies the
// stored/carried theme before first paint. It CANNOT import the helpers above (it
// runs as a standalone string before hydration), so it mirrors their logic; both
// live here so the cookie name / domain rule / read priority have one home. A
// carried `#adh-theme` is honored only when it is a safe bare key (`[-\w]+`) that
// matches a real emitted alt block — otherwise ignored (never persisted), so a
// stale/forged/deleted key can't poison the durable cookie or the selector. Any
// adh-theme hash is stripped afterwards. Applies by flipping the chosen block's
// <style> to media="all"; mutates ONLY AdhThemeStyle's own <style> nodes (never
// <html>/<body>), so no consumer layout needs suppressHydrationWarning.
//
// With NO stored/carried choice it falls back to DEFAULT_SITE_THEME — this is what makes
// the site's default theme appear in the switcher envs, where SiteDefaultTheme deliberately
// emits nothing (see AdhThemeStyle). A stored key with no alt block is a DB theme, whose CSS
// only DbThemeApplier can fetch; show the default meanwhile rather than the bare base, and
// DbThemeApplier's applyBaseTheme deactivates it a moment later. Relies on every alt block
// shipping media="not all", so activating one needs no deactivation pass.
export function themePrePaintScript(): string {
  const K = THEME_STORAGE_KEY
  const D = DEFAULT_SITE_THEME
  return (
    `(function(){try{var K='${K}',D='${D}',OK=/^[-\\w]+$/;` +
    `var hm=location.hash.match(/(?:^|[#&])${K}=([^&]+)/);` +
    `var raw=hm?decodeURIComponent(hm[1]):null;` +
    `var carried=(raw&&OK.test(raw)&&document.querySelector('style[data-adh-theme-alt="'+raw+'"]'))?raw:null;` +
    `if(carried){try{localStorage.setItem(K,carried);}catch(e){}` +
    `var hn=location.hostname,d=(hn==='localhost'||/\\.localhost$/.test(hn))?'localhost':` +
    `(function(){var p=hn.split('.');return p.length<=2?hn:p.slice(-2).join('.');})();` +
    `document.cookie=K+'='+carried+';domain='+d+';path=/;max-age=31536000;samesite=lax';}` +
    `if(hm){history.replaceState(null,'',location.pathname+location.search);}` +
    `var m=document.cookie.match(/(?:^|; )${K}=([^;]+)/);` +
    `var t=carried||(m?decodeURIComponent(m[1]):localStorage.getItem(K));` +
    `if(!t||!OK.test(t))t=D;` +
    `var s=document.querySelector('style[data-adh-theme-alt="'+t+'"]')||` +
    `document.querySelector('style[data-adh-theme-alt="'+D+'"]');` +
    `if(s)s.media='all';}catch(e){}})();`
  )
}
