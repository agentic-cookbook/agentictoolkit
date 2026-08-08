"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";
import { isForbidden } from "@agentic-toolkit/data";
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

export function RealmCatalogProvider({
  ecosystemId,
  children,
}: {
  ecosystemId?: string;
  children: ReactNode;
}) {
  const [catalog, setCatalog] = useState<RealmCatalog | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!ecosystemId) return;
    setLoadError(null);
    try {
      setCatalog(await gamificationApi.getCatalog(ecosystemId));
    } catch (err) {
      if (!isForbidden(err)) {
        reportUnexpectedAuthError(err, { feature: "gamification-catalog", step: "load" });
      }
      setLoadError(
        isForbidden(err)
          ? "You don't have access to this realm's catalog."
          : err instanceof Error
            ? err.message
            : "Failed to load the catalog.",
      );
    }
  }, [ecosystemId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<RealmCatalogValue>(
    () => ({ catalog, loadError, refresh }),
    [catalog, loadError, refresh],
  );

  return <RealmCatalogContext.Provider value={value}>{children}</RealmCatalogContext.Provider>;
}
