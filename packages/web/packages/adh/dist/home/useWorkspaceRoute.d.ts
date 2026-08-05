import type { WorkspaceOption } from './WorkspaceOption';
/** Reset the seed marker, i.e. simulate the fresh page load that resets it in a browser. Tests
 *  only — a module variable outlives a test's unmount, so without this the seed one case wrote
 *  would be read back by the next case's mount as if that case had seeded it. */
export declare function __resetSeededWorkspace(): void;
/**
 * Which workspace this URL means, and how picking another one is remembered.
 *
 * Extracted from SiteHomeShell so the hub can mount the same behaviour: the hub's workspace lives
 * at `/<slug>/home` rather than `${basePath}/<slug>`, and it lists rows (teams) the feature sites'
 * client drops — two differences that are entirely expressed by `hrefFor` and `canPersist`. The
 * resolution order, the write-ordering guards and the races they exist for are NOT duplicated:
 * this is the one copy.
 *
 * What it owns:
 *   - Resolution: a slug already in the URL decides on its own. Otherwise it seeds one — but only
 *     once workspacePrefsApi.get() has settled, so a first visit with an empty localStorage cannot
 *     write a personal-workspace guess into the URL and permanently outrank the server's real
 *     answer. Once seeding is allowed: the stored preference → the first row of `workspaces`
 *     (the caller's list is priority-ordered, personal first, so this costs no extra call).
 *   - The URL as live truth: with no (or an unknown) slug, replace to `hrefFor(resolved)`. That is
 *     what makes a site's bare `/home` a redirect rather than a page of its own — it mounts with
 *     no segment, and the first thing this does is send the browser to the resolved workspace.
 *   - Persistence, but only of an EXPLICIT act (see `pendingWrite`), and only of a slug the caller
 *     says may be persisted — and never of a slug it merely SEEDED (see `seededByUs`, which is
 *     how the mount the seeding redirect lands on still knows the slug was a guess).
 *
 * `hrefFor` and `canPersist` are effect dependencies: pass stable identities (module scope, or
 * useCallback) or the effects re-run on every render. Re-running is guarded and harmless — the
 * writes are keyed on `pendingWrite`, which a completed write clears — but it is wasted work.
 */
export declare function useWorkspaceRoute({ workspaces, workspaceSlug, hrefFor, canPersist, }: {
    /** The caller's workspaces, or null while the list is still loading. */
    workspaces: readonly WorkspaceOption[] | null;
    /** The workspace segment as it stands in the URL, if any. */
    workspaceSlug?: string;
    /** Where a workspace lives on this host. */
    hrefFor: (slug: string) => string;
    /** Whether a slug may be written as the CROSS-SITE preference. Defaults to "any of them".
     *  The hub passes one because its list includes teams, which no feature site can scope to:
     *  persisting a team would silently cost the user their real choice on every other site, since
     *  a stored slug that is not in a site's list is dropped at resolution and falls back to the
     *  personal workspace. A team pick still navigates — it just is not remembered elsewhere. */
    canPersist?: (slug: string) => boolean;
}): {
    /** `undefined` = not yet decided. `null` = decided, and this user has no workspaces at all. */
    resolved: string | null | undefined;
    /** Pick a workspace: navigates, and (if allowed) remembers it once the URL lands. */
    onSelect: (slug: string) => void;
};
//# sourceMappingURL=useWorkspaceRoute.d.ts.map