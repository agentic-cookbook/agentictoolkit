"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";

import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";
import { isForbidden, useResourceItemQuery } from "@agentic-toolkit/data";
import { gamificationApi, type RealmCatalog } from "@agentic-toolkit/data/gamification";

/**
 * The realm's effective catalog, fetched ONCE for however many sections read it.
 *
 * Badges and the level ladder arrive in the same GET …/catalog response and are edited by
 * two different topics, so neither can own the fetch: splitting them into
 * {@link CatalogSection} and {@link LevelsSection} without this would issue two identical
 * requests wherever both are shown (the hub's combined pane), and — worse — leave each
 * section's copy stale after the other's write. A ladder PUT changes the badge rows'
 * `source` tags, which is exactly why the pre-split editor re-read the catalog after saving
 * levels.
 *
 * One provider, one `refresh`, so a write in either section re-reads for both.
 *
 * The catalog is CACHED per realm, so returning to a realm shows its badges and ladder on the
 * first frame and re-reads behind them. The provider still exists for the reason above — the
 * cache would keep two sections' reads down to one request, but not the "a ladder write restages
 * the badge rows" coupling, which is a fact about this response, not about caching.
 */
interface RealmCatalogValue {
  catalog: RealmCatalog | null;
  /** The load error, already turned into something a user can read. */
  loadError: string | null;
  refresh: () => Promise<void>;
}

const RealmCatalogContext = createContext<RealmCatalogValue | null>(null);

export function useRealmCatalog(): RealmCatalogValue {
  const ctx = useContext(RealmCatalogContext);
  if (!ctx) {
    throw new Error("useRealmCatalog must be used inside a <RealmCatalogProvider>");
  }
  return ctx;
}

/**
 * Read one realm's catalog, classifying the failure itself.
 *
 * A 403 is EXPECTED here — it is what a realm the caller cannot see returns — so it is turned into
 * a sentence about permissions and deliberately NOT reported as an incident. That is also why the
 * call site passes `reportErrors: false`: this function reports the failures that are worth
 * reporting, and one failure reported twice under two contexts would be worse than none.
 *
 * Module scope, so one identity serves every mount. The realm is the query key's id, not something
 * closed over.
 */
async function loadRealmCatalog(ecosystemId: string): Promise<RealmCatalog> {
  try {
    return await gamificationApi.getCatalog(ecosystemId);
  } catch (err) {
    if (isForbidden(err)) throw new Error("You don't have access to this realm's catalog.");
    reportUnexpectedAuthError(err, { feature: "gamification-catalog", step: "load" });
    // A non-Error rejection would otherwise reach the user as the hook's generic wording; keep the
    // sentence this provider has always shown for it.
    throw err instanceof Error ? err : new Error("Failed to load the catalog.");
  }
}

export function RealmCatalogProvider({
  ecosystemId,
  children,
}: {
  ecosystemId?: string;
  children: ReactNode;
}) {
  const { item: catalog, error: loadError, reload } = useResourceItemQuery<RealmCatalog>(
    "realm-catalog",
    ecosystemId ?? null,
    loadRealmCatalog,
    { reportErrors: false },
  );

  // Swallowing, because every caller re-reads AFTER its own write succeeded: a failed re-read must
  // not be reported as a failed save. It still reaches the screen — as `loadError`.
  const refresh = useCallback(() => reload().catch(() => {}), [reload]);

  const value = useMemo<RealmCatalogValue>(
    () => ({ catalog, loadError, refresh }),
    [catalog, loadError, refresh],
  );

  return <RealmCatalogContext.Provider value={value}>{children}</RealmCatalogContext.Provider>;
}
