import { type SiteEnv } from '@agentic-toolkit/adh-registry';
import { type PopoverEntry, type RouteSection } from '@agentic-toolkit/adh/header';
/**
 * Whether this BUILD carries the dev tooling for everyone: true in the three dev
 * envs, false in production. See {@link DEV_BUILD} for the folding rules — this is
 * that same flag under the name the site menu has always used for it.
 *
 * NOT the only door anymore: a signed-in adh admin unlocks the same rows at
 * runtime in ANY env, production included (see {@link SiteMenu}'s
 * `devToolsUnlocked` and DevToolsOptions.adminUnlocked). That admin unlock is why
 * a dev affordance that must NOT exist in production can't rely on this flag alone
 * — the site-theme editor is gated on DEV_BUILD directly for exactly that reason.
 */
export declare const DEV_TOOLS_BUILD_ENABLED: boolean;
export declare function isDevEnv(env: SiteEnv | null): boolean;
export type DevToolsOptions = {
    /** This site's route map. Absent ⇒ no Routes flyout (the site passed none). */
    routes?: RouteSection[];
    /** Env AFTER the dev override — gates Routes, so simulating production hides it
     *  and the preview stays honest. */
    effectiveEnv: SiteEnv | null;
    /** Env BEFORE the dev override — gates Debug Options, so simulating production
     *  can never lock a developer out of un-simulating. */
    realEnv: SiteEnv | null;
    /** The signed-in user is an adh admin: show BOTH rows regardless of env —
     *  production included. Overrides every env gate below (an admin simulating
     *  production keeps Routes too: the simulation is for previewing what visitors
     *  get, and an admin never stops being an admin). */
    adminUnlocked: boolean;
    /** The active dev override, surfaced in the Debug row's label. */
    override: SiteEnv | null;
    pathname: string;
    onOpenDebug: () => void;
};
/**
 * The dev-only Routes / Debug Options rows for the current env, or `[]`.
 *
 * The two rows read DIFFERENT envs on purpose:
 *  - Routes follows the EFFECTIVE env — while you simulate production it hides,
 *    so what you're previewing matches what production would render.
 *  - Debug Options follows the REAL env — it stays reachable even while
 *    simulating production, so the simulation is always reversible.
 *
 * `adminUnlocked` bypasses both env reads: a signed-in adh admin always gets the
 * full dev tail, in every env including production.
 */
export declare function buildDevToolsEntries({ routes, effectiveEnv, realEnv, adminUnlocked, override, pathname, onOpenDebug, }: DevToolsOptions): PopoverEntry[];
//# sourceMappingURL=devToolsEntries.d.ts.map