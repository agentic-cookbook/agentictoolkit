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
     *  header. Used as the in-hub slug fallback on the slug-less workspace shell
     *  routes (`/home`, `/home/settings`, …), where there's no slug segment to read —
     *  so the workspace menu resolves its feature links against the user's own slug
     *  instead of degrading to slug-less (broken) links. */
    personalSlug?: string;
};
/**
 * The shared menu engine: turns a declarative {@link MenuGroup} config into the
 * resolved {@link PopoverEntry} rows (env-aware, SSO-wrapped, `current`-marked) and
 * the navigation handler. Extracted from {@link SiteMenu} as the single source of
 * truth for the switcher's link logic.
 */
export declare function useSiteMenu(groups: MenuGroup[], { currentSiteId, resolveHref, personalSlug }: UseSiteMenuOpts): {
    entries: PopoverEntry[];
    navigate: (item: PopoverItem) => void;
    homeHref: string;
};
//# sourceMappingURL=useSiteMenu.d.ts.map