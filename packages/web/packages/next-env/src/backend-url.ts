/**
 * The shared backend origin every site's BFF proxy forwards to — ONE definition, so a site that
 * declares its own proxy rule cannot drift from the baseline `/api/system/*` rule (they must
 * agree; they used to be two copies of the same expression).
 *
 * `requireExplicit` — on a HOSTED deploy (Vercel sets `VERCEL_ENV` on every build, preview
 * included), refuse to fall back to `localhost`: nothing there can reach a developer's machine, so
 * the default can only produce a proxy that 502s on every call at runtime. Failing the build names
 * the missing variable instead. OFF by default: this is the shared base for ~45 sites and flipping
 * it fleet-wide would fail the deploy of any site that has been getting by without the var. A site
 * whose whole function depends on the backend opts in (see sites/bitbag/next.config.ts).
 *
 * Ported unchanged from `frontend/src/next-config-base.mjs:91`.
 *
 * @returns the origin, trailing slashes stripped
 */
export function resolveBackendUrl(opts: { requireExplicit?: boolean } = {}): string {
  const raw = process.env.API_BACKEND_URL?.trim();
  if (!raw && opts.requireExplicit && process.env.VERCEL_ENV) {
    throw new Error(
      "API_BACKEND_URL is not set. This is a hosted build (VERCEL_ENV=" +
        `${process.env.VERCEL_ENV}), where the localhost default cannot reach any backend — ` +
        "set API_BACKEND_URL to the backend origin for this environment.",
    );
  }
  return (raw || "http://localhost:3000").replace(/\/+$/, "");
}
