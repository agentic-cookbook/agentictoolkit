/**
 * Makes the family's theming follow the PERSON, not the browser.
 *
 * Every adh site mounts this (it rides inside the shared AuthProvider — see wired-provider.tsx —
 * which is the one component they all mount and the only place `useAuth()` is guaranteed to
 * resolve). The rule it enforces is the whole feature:
 *
 *   signed in  → the colour mode + a11y prefs saved against the USER (GET /api/me/appearance)
 *   signed out → no prefs to speak of, so follow the OPERATING SYSTEM (colour mode 'auto')
 *
 * It has to be a server round-trip rather than a cookie or localStorage: the ~45 brand sites live
 * on as many registrable domains, so nothing browser-local can cross from one to the next. What
 * localStorage still does is absorb the LATENCY — the pre-paint script (APPEARANCE_PREPAINT_SCRIPT,
 * emitted by AdhThemeStyle into every site's <head>) repaints from the cached copy before first
 * paint, and this component corrects it a moment later if the server disagrees. A first visit to a
 * new site has no cache, so it paints in the OS mode and then settles into the user's — one
 * correction, once per site, rather than a flash on every page.
 *
 * Sign-out CLEARS the cache, so the next person to use the browser starts from their OS setting
 * instead of inheriting a stranger's theme.
 */
export declare function AppearanceSync(): null;
//# sourceMappingURL=AppearanceSync.d.ts.map