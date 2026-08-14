import { FONT_CACHE_HEADERS } from "./font-cache.js";
import { SECURITY_HEADERS } from "./security.js";

/** A single Next `headers()` rule: a path pattern plus the header entries applied to it. */
export interface HeaderRule {
  source: string;
  headers: Array<{ key: string; value: string }>;
}

/**
 * The slice of Next's `NextConfig` this module reads — just `headers`, not the whole
 * config surface, so this package takes no dependency on the `next` package itself.
 */
export interface NextConfig {
  headers?: () => Promise<HeaderRule[] | undefined> | HeaderRule[] | undefined;
}

/**
 * A Next `headers()` that adds {@link SECURITY_HEADERS} as a baseline on every route while letting
 * an app-defined `headers()` OVERRIDE any of them. Next applies matching header entries in array
 * order and, for a duplicate key on an overlapping path, the LAST one wins — so the baseline is
 * emitted FIRST and the app's own rules come after, meaning e.g. an app that ships a stricter
 * `Content-Security-Policy` keeps it instead of having it clobbered by this baseline.
 *
 * Ported unchanged (renamed from `mergedHeaders`) from `frontend/src/next-config-base.mjs:64`.
 */
export function mergeHeaders(config: NextConfig): () => Promise<HeaderRule[]> {
  const appHeaders = config?.headers;
  return async () => {
    const existing = typeof appHeaders === "function" ? (await appHeaders()) ?? [] : [];
    return [
      { source: "/(.*)", headers: SECURITY_HEADERS },
      { source: "/fonts/:path*", headers: FONT_CACHE_HEADERS },
      ...existing,
    ];
  };
}
