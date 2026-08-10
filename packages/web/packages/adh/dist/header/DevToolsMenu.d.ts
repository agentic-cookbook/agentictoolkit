import { type ReactElement } from 'react';
import { type SiteId } from '@agentic-toolkit/adh-registry';
import { type RouteSection } from '@agentic-toolkit/adh/header';
export type DevToolsMenuProps = {
    /** Which site this header belongs to — marks the "current" row in the site-family
     *  flyouts, and selects whose routes the Routes flyout lists. */
    currentSiteId: SiteId;
    /** Transform a cross-site destination href before use (SSO wrap), exactly as
     *  {@link SiteMenu} takes it — so a jump to a sibling site's build lands already
     *  signed in. Absent ⇒ plain navigation. */
    resolveHref?: (defaultHref: string) => string;
    /** The signed-in user's personal workspace slug, forwarded to {@link useSiteMenu}
     *  as the in-hub slug fallback on the slug-less workspace shell routes. */
    personalSlug?: string;
    /** Curated route map for the "Routes" flyout. When a site passes none, the flyout
     *  falls back to the generated per-site route map
     *  (`@agentic-toolkit/adh-registry/routes`), loaded lazily once this menu mounts. */
    routes?: RouteSection[];
    /** The signed-in user holds the adh `admin` capability. Unlocks this menu in EVERY
     *  env, production included. A display courtesy, not a security boundary —
     *  everything it reveals (site lists, route paths, the debug console) ships in the
     *  client bundle for anyone to read; the backend enforces real authorization. */
    userIsAdmin?: boolean;
};
/**
 * The dev-tools dropdown, or nothing at all.
 *
 * The single unlock: every visitor in a dev-env build, OR a signed-in adh admin in
 * ANY env — production included. The admin leg is a runtime condition, so the code
 * below ships in production bundles; it stays invisible and unfetched for non-admins.
 *
 * The gate is a wrapper around {@link DevToolsMenuPopover} rather than an early
 * return inside it because `userIsAdmin` resolves ASYNCHRONOUSLY (the auth source
 * settles after first paint). An early return past this component's hooks would
 * change the hook count on that flip; mounting a child whole does not. It also keeps
 * the popover's work — resolving a cross-site href for every site in the family —
 * off every render of every page for the visitors who will never see the menu.
 */
export declare function DevToolsMenu({ userIsAdmin, ...rest }: DevToolsMenuProps): ReactElement | null;
//# sourceMappingURL=DevToolsMenu.d.ts.map