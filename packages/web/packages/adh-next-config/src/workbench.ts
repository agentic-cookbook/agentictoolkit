import type { NextConfig } from "next";
import { mergeHeaders } from "@agentic-toolkit/next-headers";
import { commitSha, readSiteVersion, resolveBackendUrl } from "@agentic-toolkit/next-env";
// Same import-by-name rationale as index.ts's — see the long comment there.
import { materializeThemeFonts } from "@agentic-toolkit/themes/materialize-fonts";

/** What a workbench must supply, and the little it may. */
export type WorkbenchNextConfigOptions = {
  /**
   * The directory Turbopack and output-file tracing are pinned to. REQUIRED, unlike
   * {@link import("./index.js").AdhNextConfigOptions.workspaceRoot}, because a workbench
   * has no derivable default: `adhNextConfig` computes `frontend/src` from the site's own
   * two-levels-up position, and a workbench is not under `frontend/src` at all — that
   * mismatch is the whole reason this function exists rather than the workbenches calling
   * `adhNextConfig`. Turbopack REFUSES a root that is not an ancestor of the project being
   * built, so a wrong value fails loudly rather than silently widening the watch scope.
   */
  readonly workspaceRoot: string;
  /** Extra Next `experimental` keys, merged exactly as `adhNextConfig` merges them. */
  readonly experimental?: NextConfig["experimental"];
};

/**
 * The shared Next config for the repo-root `local/` workbenches — `ui-showcase` and
 * `content-studio`.
 *
 * They are not sites: they have no registry entry, serve no visitor, and have no Vercel
 * project. `adhNextConfig` cannot serve them, and not by omission — `currentSiteId`
 * THROWS (`Cannot build: "<name>" is not a registered site.`) for a directory the fleet
 * registry does not name, which is a property worth keeping: it is what stops a real site
 * from being built under a slug nobody registered. So the non-site half of the shared
 * config is factored out here.
 *
 * What they got from `withAdhConfig` and keep: the security-header baseline, the theme
 * font materialization, `devIndicators: false`, the `staleTimes` router-cache default, the
 * `/api/system/*` BFF proxy the shared chrome's feature-flag gate needs, the three build
 * identity `env` constants, and the workspace-root pin.
 *
 * What they do NOT get, each for a reason:
 *
 * - **No `currentSiteId` / registry lookup.** See above.
 * - **No `assertAuthApiUrl`.** It is gated on `VERCEL_ENV`, which a never-deployed
 *   workbench never sets, so it was already a no-op for these two on main.
 * - **No `assertHoistableDeps` / `assertLinkedDepsInstalled`.** Both answer questions about
 *   a SITE's dependency closure as `vercel-isolate-deps.py` and the deploy see it. A
 *   workbench is neither isolated nor deployed, and pointing a site-shaped gate at one
 *   would assert a property nothing enforces — the exact "check that rots" the design spec
 *   §3 catalogues. (`assertLinkedDepsInstalled` would in fact pass; running it here anyway
 *   would be the first step toward it being read as fleet coverage, which it is not.)
 * - **No wholesale `/api/:path*` proxy.** That is a site's BFF, wired to a real backend;
 *   `withAdhConfig` never gave the workbenches one and `mergedRewrites`' narrow
 *   `/api/system/*` baseline is what they actually had.
 */
export function workbenchNextConfig(options: WorkbenchNextConfigOptions): NextConfig {
  const dir = process.cwd();
  materializeThemeFonts();
  // Never `requireExplicit`: local-only by construction, so the localhost default is the
  // point rather than a hazard — there is no hosted build here to fail.
  const backendUrl = resolveBackendUrl();

  return {
    devIndicators: false,
    distDir: process.env.ADH_DIST_DIR || ".next",
    env: {
      NEXT_PUBLIC_DEPLOYMENT_ENV:
        process.env.DEPLOYMENT_ENV ?? process.env.NEXT_PUBLIC_DEPLOYMENT_ENV,
      NEXT_PUBLIC_ADH_SITE_VERSION: readSiteVersion(dir),
      NEXT_PUBLIC_ADH_RELEASE: commitSha(),
    },
    headers: mergeHeaders({}),
    async rewrites() {
      // The shared chrome in `@agentic-toolkit/adh` reads `/system/feature-flags` from
      // whatever mounts it, the workbenches included — `mergedRewrites`
      // (`next-config-base.mjs:164`) declared this once for every app for that reason.
      return [{ source: "/api/system/:path*", destination: `${backendUrl}/system/:path*` }];
    },
    experimental: {
      ...options.experimental,
      staleTimes: { dynamic: 30, ...options.experimental?.staleTimes },
    },
    // The VERCEL guard is kept for symmetry with `adhNextConfig` rather than because it
    // can fire: neither workbench has a Vercel project. If one ever did, the pin would
    // mis-join `.next` exactly as it would for a site — see index.ts's comment.
    ...(process.env.VERCEL
      ? {}
      : {
          turbopack: { root: options.workspaceRoot },
          outputFileTracingRoot: options.workspaceRoot,
        }),
  };
}
