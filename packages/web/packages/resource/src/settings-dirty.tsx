"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { UnsavedChangesGuard } from "@agentic-toolkit/ui/components/unsaved-changes-guard";
import { useRailExitGuard, useRailHost } from "./rail-host";

type SettingsDirtyContextValue = {
  /** A panel reports whether it currently has unsaved edits. */
  reportDirty: (key: string, dirty: boolean) => void;
  /** True if any mounted panel has unsaved edits. Read on close, not render. */
  isAnyDirty: () => boolean;
};

const NOOP: SettingsDirtyContextValue = {
  reportDirty: () => {},
  isAnyDirty: () => false,
};

const SettingsDirtyContext = createContext<SettingsDirtyContextValue>(NOOP);

export function useSettingsDirty(): SettingsDirtyContextValue {
  return useContext(SettingsDirtyContext);
}

/**
 * Publish one editor's unsaved edits into the enclosing registry for as long as they last, and
 * withdraw them on unmount — so a pane the user navigates away from can't leave the exit guard
 * armed forever.
 *
 * `key` namespaces the entry: sibling instances of the same form (one per connection, say) MUST
 * fold their own id into it, or the second overwrites the first's report. `dirty` must be a real
 * diff of the draft against the baseline it loaded, never "the user touched something" — a guard
 * that fires when nothing changed nags on every exit, which is worse than the missing prompt.
 *
 * Outside a provider this is inert (the NOOP context's `reportDirty`), which is what lets these
 * editors render on non-settings surfaces unchanged.
 */
export function useReportSettingsDirty(key: string, dirty: boolean): void {
  const { reportDirty } = useSettingsDirty();
  useEffect(() => {
    reportDirty(key, dirty);
    return () => reportDirty(key, false);
  }, [key, dirty, reportDirty]);
}

/**
 * Tracks which settings panels have unsaved edits, and bridges that to the two exits a panel
 * can't guard itself. Panels report into a ref (no re-render per keystroke) and read
 * `isAnyDirty()` from event handlers — the overlay's close/tab-switch gate. The SAME fact is
 * mirrored into `anyDirty` STATE, because both bridges below are render values and a ref read
 * during render is not reactive:
 *
 *  - Inside a rail host (the hub's WorkspaceChromeProvider around every `/[slug]/…` route; a
 *    feature site's RailHostBoundary) it publishes a {@link useRailExitGuard} entry while
 *    dirty. That is the host's ONE guard registry, so settings dirt reaches both the host's
 *    browser-level `UnsavedChangesGuard` (reload / tab close / link click / Back) and the
 *    composite `exitGuard` the stack consults before clearing a level (rail row switch,
 *    breadcrumb up).
 *  - With no host above (the `/home/settings` route, the header's User Settings overlay) there
 *    is no chrome to mount that guard, so this mounts its own.
 *
 * Registration is gated on dirty, never on "a settings panel is mounted", so a clean pane never
 * nags on exit. Outside a provider both context calls are no-ops.
 */
export function SettingsDirtyProvider({ children }: { children: ReactNode }) {
  // A provider nested inside another DEFERS to it rather than shadowing it (React's nearest
  // Provider wins, which would silently strand the outer registry's readers — the overlay's
  // close gate is one). Reuse means a mount added above one of these can never break the ones
  // already there.
  const nested = useContext(SettingsDirtyContext) !== NOOP;

  const dirtyRef = useRef<Map<string, boolean>>(new Map());
  const [anyDirty, setAnyDirty] = useState(false);

  // Stable across renders (the state setter is), so a panel's `reportDirty` effect doesn't
  // re-run — and can't loop — when the dirty flip re-renders this provider.
  const reportDirty = useCallback((key: string, dirty: boolean) => {
    if (dirty) dirtyRef.current.set(key, true);
    else dirtyRef.current.delete(key);
    setAnyDirty(dirtyRef.current.size > 0);
  }, []);
  const isAnyDirty = useCallback(() => dirtyRef.current.size > 0, []);

  const value = useMemo<SettingsDirtyContextValue>(
    () => ({ reportDirty, isAnyDirty }),
    [reportDirty, isAnyDirty],
  );

  // Publishes into the enclosing rail host's guard registry; a no-op with no host.
  useRailExitGuard(
    !nested && anyDirty ? { isDirty: () => dirtyRef.current.size > 0 } : null,
  );
  const host = useRailHost();

  if (nested) return <>{children}</>;
  return (
    <SettingsDirtyContext.Provider value={value}>
      {host === null && <SettingsBrowserExitGuard when={anyDirty} />}
      {children}
    </SettingsDirtyContext.Provider>
  );
}

/** The browser-level guard for a settings surface with no rail host above it. Split into its own
 *  component so `useRouter` runs ONLY on that path — under a host the chrome owns the one mount
 *  and this never renders, so nothing here needs an app router. */
function SettingsBrowserExitGuard({ when }: { when: boolean }) {
  const router = useRouter();
  return <UnsavedChangesGuard when={when} onNavigate={(href) => router.push(href)} />;
}
