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
};
/**
 * The shared menu engine: turns a declarative {@link MenuGroup} config into the
 * resolved {@link PopoverEntry} rows (env-aware, SSO-wrapped, `current`-marked) and
 * the navigation handler. Extracted from {@link SiteMenu} as the single source of
 * truth for the switcher's link logic.
 */
export declare function useSiteMenu(groups: MenuGroup[], { currentSiteId, resolveHref, personalSlug, authenticated }: UseSiteMenuOpts): {
    entries: PopoverEntry[];
    navigate: (item: PopoverItem) => void;
    /** The signed-in Home destination, resolved by the same route logic as every
     *  config-driven row. The one row SiteMenu still builds by hand that needs a
     *  resolved href — everything else it renders is either a plain action (Help) or a
     *  {@link MenuGroup} the `entries` above already resolved. */
    homeHref: string;
};
//# sourceMappingURL=useSiteMenu.d.ts.map