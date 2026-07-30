import { type SiteEnv } from '@agentic-toolkit/adh-registry';
/**
 * Parse a raw stored value into a valid {@link SiteEnv}, or `null` when it's
 * absent or not a known env. Pure — the single validation point shared by the
 * store reader and the tests.
 */
export declare function parseEnvOverride(raw: string | null | undefined): SiteEnv | null;
/**
 * The effective environment: the dev override when set, otherwise the env
 * detected from the host. Pure — the source of truth both {@link useEffectiveEnv}
 * and the tests use.
 */
export declare function resolveEffectiveEnv(override: SiteEnv | null, detected: SiteEnv | null): SiteEnv | null;
/** The current override (client-only; `null` on the server). */
export declare function getEnvOverride(): SiteEnv | null;
/** Set or clear the dev environment override, persisting it and notifying subscribers. */
export declare function setEnvOverride(env: SiteEnv | null): void;
/**
 * Subscribe to the override: `null` on the server and the first client render
 * (so it can't cause a hydration mismatch), then live thereafter.
 */
export declare function useEnvOverride(): SiteEnv | null;
/**
 * The effective environment for `hostname`, honoring the dev override. `null`
 * until the host is known (SSR / first render) and no override is set.
 */
export declare function useEffectiveEnv(hostname: string | null): SiteEnv | null;
//# sourceMappingURL=envOverride.d.ts.map