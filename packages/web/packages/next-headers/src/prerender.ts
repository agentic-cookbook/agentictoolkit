/**
 * Opts credentialed pages in to cross-origin, SAME-SITE prerendering, so the header
 * site-switcher can prerender a sibling site on hover and activate it INSTANTLY on
 * click — no full-page reload, no white "ugly refresh". The browser only honours this
 * for same-site siblings (local-dev `*.dev.local`, where every site in a family is a
 * subdomain of one suite host); it is a harmless no-op in prod, where each deployed
 * site is its own cross-site registrable domain and prerender is disallowed by the
 * platform. Paired with `PrefetchSiblingSites` in `@agentic-toolkit/adh`, which emits
 * the matching speculation rules.
 *
 * Ported unchanged from `frontend/src/sites/marketing.next-config.mjs:82-89`, and
 * promoted from marketing-only to the shared baseline set (Task 5 fix round): the
 * header switcher is fleet-wide chrome, and `@agentic-toolkit/next-config` is the one
 * config every site now calls, so every site gets the hover-prerender benefit rather
 * than only the 22 former marketing sites.
 */
export const PRERENDER_HEADERS: Array<{ key: string; value: string }> = [
  { key: "Supports-Loading-Mode", value: "credentialed-prerender" },
];
