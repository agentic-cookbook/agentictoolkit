import { type SiteId } from '@agentic-toolkit/adh-registry';
import { type PopoverEntry, type PopoverItem } from '@agentic-toolkit/adh/header';
import { type MenuGroup } from './SiteMenu';
/** What every consumer of the declarative menu needs to resolve it. */
export type UseSiteMenuOpts = {
    /** Which site this header belongs to — drives in-hub switching + the "current" marker. */
    currentSiteId: SiteId;
    /** Transform a cross-site destination href before use (SSO wrap). Injected by the
     *  auth-aware header when signed in; absent ⇒ plain navigation. See SiteMenu's
     *  `resolveHref` for the full contract. */
    resolveHref?: (defaultHref: string) => string;
    /** The signed-in user's personal workspace slug, threaded from the auth-aware
     *  header. Used as the in-hub slug fallback on the slug-less workspace routes
     *  (`/home`, `/settings/*`), where there's no slug segment to read — so the
     *  workspace menu resolves its feature links against the user's own slug
     *  instead of degrading to slug-less (broken) links. */
    personalSlug?: string;
    /** Whether a user is signed in. Gates the workspace CARRY below: every workspace
     *  route in the family sits behind an auth gate, so a path that merely parses as
     *  one on a signed-out visitor is a public page that happens to share its shape,
     *  and carrying its first segment as a slug would be a guess. */
    authenticated?: boolean;
    /** Whether the workspace the visitor is in actually OFFERS the hub route for a fleet
     *  segment — injected by the hub, which is the only host that has the answer.
     *
     *  A hub route is not offered to every workspace. A TEAM is a membership grouping, not an
     *  owning principal, so the backend's workspace-owner resolver 404s a team slug by design
     *  and the hub's own rail withholds every owner-scoped feature there; the fleet route
     *  answers such a visit with "…isn't available for a team". Without this seam every site row
     *  on a team slug would resolve to one of those — forty-odd rows all leading to the same
     *  empty state, and no way left to reach the sites themselves.
     *
     *  Fails CLOSED: absent (every host but the hub, and the hub before its workspace list has
     *  landed) means no row is rerouted and the menu stays the cross-site navigator it is
     *  everywhere else — a working destination, never a dead one. The toolkit cannot answer it
     *  itself: which features a workspace type grants is the hub's `WORKSPACE_FEATURES`, and
     *  shared chrome may not import a site. */
    hubOffersFeature?: (segment: string) => boolean;
};
/**
 * The shared menu engine: turns a declarative {@link MenuGroup} config into the
 * resolved {@link PopoverEntry} rows (env-aware, SSO-wrapped, `current`-marked) and
 * the navigation handler. Extracted from {@link SiteMenu} as the single source of
 * truth for the switcher's link logic.
 */
export declare function useSiteMenu(groups: MenuGroup[], { currentSiteId, resolveHref, personalSlug, authenticated, hubOffersFeature }: UseSiteMenuOpts): {
    entries: PopoverEntry[];
    navigate: (item: PopoverItem) => void;
    /** The signed-in Home destination, resolved by the same route logic as every
     *  config-driven row. The one row SiteMenu still builds by hand that needs a
     *  resolved href — everything else it renders is either a plain action (Help) or a
     *  {@link MenuGroup} the `entries` above already resolved. */
    homeHref: string;
};
//# sourceMappingURL=useSiteMenu.d.ts.map