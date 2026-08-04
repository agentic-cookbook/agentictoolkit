"use client";

import { useCallback, useMemo, useState, type ReactElement, type ReactNode } from "react";
import { HierarchicalDetailView } from "@agentic-toolkit/ui/blocks";
import { UnsavedChangesGuard } from "@agentic-toolkit/ui/components/unsaved-changes-guard";
import {
  RailHostContext,
  useRailHost,
  type PaneExitGuard,
  type RailHostRegistry,
  type RegisteredLevels,
} from "./rail-host";

/**
 * The standalone rail host: when a feature renders OUTSIDE a host (a feature site's /home),
 * this provides its OWN {@link RailHostContext} so the topic panes' publishers work exactly as
 * they do inside the hub shell — the master/detail lists register as deeper rail levels, and the
 * leaf editor's unsaved-work guard flows into the one HTD's exit gate (so Back / breadcrumb-up /
 * re-click prompts Discard/Stay instead of silently discarding). Mirrors the hub's
 * WorkspaceChromeProvider semantics (local registry + composite guard + depth-merged stack),
 * trimmed to the standalone case: no toolbar slot, no shell workspace/feature levels, no
 * breadcrumb. Extracted from ResourceExplorer (which always self-hosted this way) so the
 * publisher-only feature entries — research/dashboards/knowledgebases/personas — get the same
 * standalone behavior through {@link RailHostBoundary}.
 */
export function StandaloneRailHost({ children }: { children: ReactNode }): ReactElement {
  const [registry, setRegistry] = useState<ReadonlyMap<string, RegisteredLevels>>(new Map());
  const [guards, setGuards] = useState<ReadonlyMap<string, PaneExitGuard>>(new Map());

  const registerLevels = useCallback((id: string, entry: RegisteredLevels) => {
    setRegistry((prev) => {
      const next = new Map(prev);
      next.set(id, entry);
      return next;
    });
  }, []);
  const unregisterLevels = useCallback((id: string) => {
    setRegistry((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);
  // Register/replace or (guard === null) withdraw one publisher's guard — the withdraw path is how a
  // guard clears when its editor unmounts (useRailExitGuard's cleanup), mirroring the hub host.
  const registerExitGuard = useCallback((id: string, guard: PaneExitGuard | null) => {
    setGuards((prev) => {
      if (guard === null && !prev.has(id)) return prev;
      const next = new Map(prev);
      if (guard === null) next.delete(id);
      else next.set(id, guard);
      return next;
    });
  }, []);

  // The one guard the HTD consults: dirty when ANY publisher is dirty; save() persists every dirty
  // publisher (all must succeed before the gated navigation proceeds).
  const exitGuard = useMemo<PaneExitGuard | null>(() => {
    if (guards.size === 0) return null;
    const all = [...guards.values()];
    return {
      isDirty: () => all.some((g) => g.isDirty()),
      save: async () => {
        for (const g of all) {
          if (g.isDirty() && !(await g.save())) return false;
        }
        return true;
      },
    };
  }, [guards]);

  const mergedLevels = useMemo(
    () => [...registry.values()].sort((a, b) => a.depth - b.depth).flatMap((e) => e.levels),
    [registry],
  );

  const host = useMemo<RailHostRegistry>(
    () => ({ registerLevels, unregisterLevels, registerExitGuard, toolbarSlot: null }),
    [registerLevels, unregisterLevels, registerExitGuard],
  );

  return (
    <RailHostContext.Provider value={host}>
      {/* Browser-level exits (reload, tab close, in-app link click, Back/Forward, and any chrome
          that awaits confirmNavigation) for every pane this host carries, from ONE mount — the same
          line the hub's WorkspaceChromeProvider carries, so a feature site's /home is guarded
          exactly as the same pane is inside the hub shell. `guards` is non-empty exactly when some
          pane is dirty (publishers register on dirty, not on "editor open"), which is what makes
          this a render value. IN-PANE exits (row switch, breadcrumb, re-click) are guarded
          separately by the HTD below via `exitGuard`.
          No `onNavigate`: this package owns no router instance, and reading one here
          (next/navigation's useRouter) would make every standalone mount require an app-router
          context — a dependency the host, not the toolkit, is the right place to supply. Discard on
          an intercepted link therefore falls back to a full document load. */}
      <UnsavedChangesGuard when={guards.size > 0} />
      <HierarchicalDetailView levels={mergedLevels} showBreadcrumb={false} exitGuard={exitGuard}>
        {children}
      </HierarchicalDetailView>
    </RailHostContext.Provider>
  );
}

/**
 * Host-or-standalone boundary: inside an existing rail host (the hub's workspace chrome) it is a
 * pure pass-through, so the feature's levels merge into the shell's one HTD; without one it
 * becomes a {@link StandaloneRailHost}. Every feature ENTRY (the component a site mounts at
 * /home) wraps its published content in this, so the same entry works under the hub shell and on
 * a bare feature site — an UNCONDITIONAL StandaloneRailHost would shadow the hub's registry and
 * render a second nested rail inside the frontier pane, which is why the conditional exists.
 */
export function RailHostBoundary({ children }: { children: ReactNode }): ReactElement {
  const host = useRailHost();
  return host ? <>{children}</> : <StandaloneRailHost>{children}</StandaloneRailHost>;
}
