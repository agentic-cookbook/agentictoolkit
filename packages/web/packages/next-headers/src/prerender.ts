/**
 * Opts credentialed pages in to cross-origin, SAME-SITE prerendering, so the header
 * site-switcher can prerender a sibling site on hover and activate it INSTANTLY on
 * click — no full-page reload, no white "ugly refresh". Paired with
 * `PrefetchSiblingSites` in `@agentic-toolkit/adh`, which emits the matching
 * speculation rules.
 *
 * Ported from `frontend/src/sites/marketing.next-config.mjs:82-89`, where it was a
 * marketing-site-only `headers()` rule.
 *
 * ## Why it is gated on the build being local ({@link prerenderHeaderRules})
 *
 * The port's first draft emitted this on every site in every environment, justified by
 * a comment claiming it was "a harmless no-op in prod, where each deployed site is its
 * own cross-site registrable domain". That premise is false twice over, and the fleet
 * registry is where it is falsified:
 *
 *  - Six deployments share ONE registrable domain — `agenticdeveloperhub.com` itself
 *    plus `mcp.`, `help.`, `admin.`, `status.` and `builder.` — so they are same-site
 *    with each other, which is exactly the condition under which the browser DOES
 *    honour this header.
 *  - Every site with `hasStaging`/`hasTesting` also serves `staging.<host>` and
 *    `testing.<host>`, same-site with each other and with the apex.
 *
 * So the header is not inert in a deployed environment; it is an opt-in granted to any
 * same-site origin, which after the fleet-wide promotion included the admin operations
 * console and the status site. A lower-trust sibling on the shared domain could
 * prerender them WITH the visitor's credentials.
 *
 * `PrefetchSiblingSites` is the only thing in the fleet that ever emits a prerender
 * speculation rule, and it returns early unless `detectEnv(hostname) === 'local'`. So
 * the opt-in is only ever ACTED ON in local dev, where the suite serves every sibling
 * as a subdomain of one `*.dev.local` host. Granting it anywhere else buys nothing and
 * widens what a same-site origin may do. Gating both halves on "is this local" — the
 * rules by hostname at runtime, this header by the absence of `VERCEL` at build time —
 * is what keeps the two from drifting apart into a grant with no consumer.
 */
export const PRERENDER_HEADERS: Array<{ key: string; value: string }> = [
  { key: "Supports-Loading-Mode", value: "credentialed-prerender" },
];

/**
 * The baseline prerender rules for this build: the opt-in off-Vercel, nothing on a
 * hosted build. See {@link PRERENDER_HEADERS} for why the gate exists.
 *
 * `process.env.VERCEL` is set in every Vercel build environment and nowhere else —
 * `next dev`, `deployment/build`, the e2e dev servers and the local suite all leave it
 * unset — which is the same signal `@agentic-toolkit/adh-next-config` already uses to
 * decide whether to pin the Turbopack workspace root.
 */
export function prerenderHeaderRules(): Array<{ source: string; headers: Array<{ key: string; value: string }> }> {
  if (process.env.VERCEL) return [];
  return [{ source: "/:path*", headers: PRERENDER_HEADERS }];
}
