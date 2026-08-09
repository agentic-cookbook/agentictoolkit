import { DEV_BUILD, isDevDeploymentEnv } from '@agentic-toolkit/adh-registry/deployment-env'
import { type SiteEnv } from '@agentic-toolkit/adh-registry'
import {
  buildRouteItems,
  type PopoverEntry,
  type RouteSection,
} from '@agentic-toolkit/adh/header'
import { DEBUG_SECTION } from './debugSiteGroups'
import { menuIcon } from './menu-icons'

// ─────────────────────────────────────────────────────────────────────────────
// The second half of the header's dev-tools dropdown: a "Routes" flyout (this
// site's own routes) and a "Debug Options" row (opens the Debug console). Both
// used to be pills in the header bar, then rows at the tail of the site menu;
// they are their own menu now, so the site menu ships unchanged between builds.
//
// Rendered after the Marketing/Main site-family flyouts and sharing their
// DEBUG_SECTION, so the whole menu reads as one contiguous run (a divider falls
// between sections, never within one).
//
// Pure (no hooks/DOM) so the env gating below — the part that must never leak a
// debug affordance to an ordinary production visitor — is unit-testable.
// {@link DevToolsMenu} supplies the envs and the admin unlock.

/**
 * Whether this BUILD carries the dev tooling for everyone: true in the three dev
 * envs, false in production. See {@link DEV_BUILD} for the folding rules — this is
 * that same flag under the name the header's dev tooling has always used for it.
 *
 * NOT the only door: a signed-in adh admin unlocks the same menu at runtime in ANY
 * env, production included (see {@link DevToolsMenu}'s `unlocked` and
 * DevToolsOptions.adminUnlocked). That admin unlock is why a dev affordance that
 * must NOT exist in production can't rely on this flag alone — the site-theme
 * editor is gated on DEV_BUILD directly for exactly that reason.
 */
export const DEV_TOOLS_BUILD_ENABLED = DEV_BUILD

export function isDevEnv(env: SiteEnv | null): boolean {
  return isDevDeploymentEnv(env)
}

export type DevToolsOptions = {
  /** This site's route map. Absent ⇒ no Routes flyout (the site passed none). */
  routes?: RouteSection[]
  /** Env AFTER the dev override — gates Routes, so simulating production hides it
   *  and the preview stays honest. */
  effectiveEnv: SiteEnv | null
  /** Env BEFORE the dev override — gates Debug Options, so simulating production
   *  can never lock a developer out of un-simulating. */
  realEnv: SiteEnv | null
  /** The signed-in user is an adh admin: show BOTH rows regardless of env —
   *  production included. Overrides every env gate below (an admin simulating
   *  production keeps Routes too: the simulation is for previewing what visitors
   *  get, and an admin never stops being an admin). */
  adminUnlocked: boolean
  /** The active dev override, surfaced in the Debug row's label. */
  override: SiteEnv | null
  pathname: string
  onOpenDebug: () => void
}

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
export function buildDevToolsEntries({
  routes,
  effectiveEnv,
  realEnv,
  adminUnlocked,
  override,
  pathname,
  onOpenDebug,
}: DevToolsOptions): PopoverEntry[] {
  const out: PopoverEntry[] = []

  if (routes && routes.length > 0 && (adminUnlocked || isDevEnv(effectiveEnv))) {
    out.push({
      kind: 'topic',
      section: DEBUG_SECTION,
      label: 'Routes',
      icon: menuIcon('routes'),
      items: buildRouteItems(routes, pathname),
    })
  }

  if (adminUnlocked || isDevEnv(realEnv)) {
    out.push({
      kind: 'leaf',
      section: DEBUG_SECTION,
      // `blurb` is what actually RENDERS a leaf's description (see NavigationPopover's
      // leaf branch) — without it the "Sim: prod" hint below would be set but invisible.
      blurb: true,
      item: {
        key: 'debug-options',
        label: 'Debug Options',
        // Carries the old header pill's "Sim: prod" state, so it stays obvious the
        // site is being viewed AS production rather than for real. Kept OUT of the
        // label so the row's accessible name is stably "Debug Options".
        description: override === 'production' ? 'Sim: prod' : undefined,
        icon: menuIcon('debug'),
        onSelect: onOpenDebug,
      },
    })
  }

  return out
}
