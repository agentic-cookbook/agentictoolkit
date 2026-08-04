"use client";

// The rail-host contract: a HOST (e.g. the hub's one-rail workspace shell) may
// provide this registry; feature content publishes its rail levels/guards into it
// via StackLevels/useStackLevel/useRailExitGuard/ToolbarPortal below. With NO
// provider, publishers no-op and the feature (ResourceExplorer) renders its own
// HierarchicalTopicDetail (standalone mode — what the feature sites use). The host
// side (the provider that owns `mergedLevels` / the composite `exitGuard` / the
// toolbar slot state) lives in the consuming app; this package owns only the
// contract + the publisher hooks.

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type { TopicLevel, PaneExitGuard } from "@agentic-toolkit/ui/blocks";

// The package owns the unsaved-work guard contract by re-exporting the single
// authoritative type; feature editors import it from the rail-host module they
// already use.
export type { PaneExitGuard };

export interface RegisteredLevels {
  /** Position in the merged stack — set from the surrounding {@link LevelDepthContext}, so a
   *  publisher's levels land after every ancestor's (parents render first, so their depth is
   *  known when a descendant registers). */
  depth: number;
  levels: TopicLevel[];
}

/**
 * The host-side contract this package OWNS and a host (the hub's workspace shell) provides. Trimmed
 * to exactly the members the publisher hooks below read: level (un)registration, exit-guard
 * registration, and the toolbar portal slot. The host keeps its own internal state (the merged
 * stack, the composite guard, the slot setter) private.
 */
export interface RailHostRegistry {
  /** Register (or replace) a publisher's rail levels at a depth. Keyed by a stable id so the
   *  publisher can update/unregister. */
  registerLevels: (id: string, entry: RegisteredLevels) => void;
  unregisterLevels: (id: string) => void;
  /** Register/replace (guard) or withdraw (null) one publisher's guard, keyed by a stable id. */
  registerExitGuard: (id: string, guard: PaneExitGuard | null) => void;
  /** The DOM node of the shell's full-width button-bar slot; feature editors portal their action
   *  bar here so it spans the top instead of sitting inside the detail. Null with no host. */
  toolbarSlot: HTMLElement | null;
}

/** The context a host provides (via {@link RailHostContext.Provider}, owning `value`) to publish its
 *  registry; publishers read it through the hooks below. */
export const RailHostContext = createContext<RailHostRegistry | null>(null);

/** Read the host registry (views null-check it for "am I inside a rail host?" to decide
 *  publish-vs-render-own-rail). Null when no host is mounted. */
export function useRailHost(): RailHostRegistry | null {
  return useContext(RailHostContext);
}

/**
 * The depth of the NEXT level a publisher should register at. The host's children start at 0; each
 * {@link StackLevels} adds its level count, so a nested chain (feature ▸ group ▸ list ▸ editor
 * topics) registers in tree order and the merged stack reads outermost-first. Render-time context
 * (not effects) so a descendant reads its ancestors' depth during its own render.
 */
const LevelDepthContext = createContext(0);

/** Serialise a level array's identity (id, title, selection, and every row's id + label +
 *  sublabel) so the publish effect re-runs on any change the merged stack renders — including a
 *  live rename of the level's title (e.g. a persona's name) or a row label/sublabel (e.g. an
 *  integration flipping from its auth method to "Configured"), which `items.length` alone would
 *  miss and leave stale in the rail header / breadcrumb. Not every render's new array/closure
 *  identity. */
function levelsKey(levels: TopicLevel[]): string {
  return levels
    .map(
      // `emptyLabel` is part of the key: an empty list's rows don't change between "Loading…",
      // "Nothing here yet.", and an error message, so without it a list that resolves from loading
      // to empty/error would keep re-showing the stale "Loading…" (the level never re-registers).
      // `overview` too: it flips (false) while a master/detail inline editor is open —
      // same re-registration need as emptyLabel, or the frontier keeps the stale card grid.
      (l) =>
        `${l.id}:${l.title ?? ""}:${l.selectedId ?? ""}:${l.emptyLabel ?? ""}:${l.defaultSelectedId ?? ""}:${
          l.overview === false ? "!o" : ""
        }:${l.items
          .map((it) => `${it.id}=${it.label}=${it.sublabel ?? ""}`)
          .join(",")}`,
    )
    .join("|");
}

/**
 * Publish a chain link's rail levels into the merged stack AND advance the depth for its children,
 * so a deeper view (a group's member, a master/detail list, an editor's topics) lands AFTER it.
 * Renders its `children` (the next-deeper content / the leaf) — the levels themselves are rendered
 * by the host's one HierarchicalTopicDetail, not inline here. No-op outside a host (the view still
 * renders standalone), so callers keep their own-HTD fallback for that case.
 */
export function StackLevels({ levels, children }: { levels: TopicLevel[]; children: ReactNode }) {
  const depth = useContext(LevelDepthContext);
  const ctx = useContext(RailHostContext);
  const id = useId();
  const register = ctx?.registerLevels;
  const unregister = ctx?.unregisterLevels;
  // Re-runs whenever `key` (id + selection + row count per level) changes; the effect closure holds
  // the latest `levels` at that point, so no ref is needed to register fresh values.
  const key = levelsKey(levels);
  useLayoutEffect(() => {
    if (!register || !unregister) return;
    register(id, { depth, levels });
    return () => unregister(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [register, unregister, id, depth, key]);
  return (
    <LevelDepthContext.Provider value={depth + levels.length}>{children}</LevelDepthContext.Provider>
  );
}

/**
 * Publish ONE leaf-most rail level (a master/detail list, whose detail — the editor — publishes
 * nothing deeper) at the current depth. A hook, not a wrapper, because there is no deeper child to
 * advance the depth for. Pass null to clear (single-record topics). No-op outside a host.
 */
export function useStackLevel(level: TopicLevel | null): void {
  const depth = useContext(LevelDepthContext);
  const ctx = useContext(RailHostContext);
  const register = ctx?.registerLevels;
  const unregister = ctx?.unregisterLevels;
  const id = useId();
  const key = level ? `${depth}:${levelsKey([level])}` : "";
  useLayoutEffect(() => {
    if (!register || !unregister) return;
    if (!level) {
      unregister(id);
      return;
    }
    register(id, { depth, levels: [level] });
    return () => unregister(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [register, unregister, id, key]);
}

/**
 * A feature's leaf editor calls this to publish (or clear) its unsaved-work guard so the host can
 * prompt Discard/Stay before a Back / breadcrumb-up / re-click clears the level. Co-mountable:
 * each caller registers under its own stable id and only ever withdraws ITSELF, so a pane's form
 * guard and a topic's data-editor guard coexist (the host consults the composite). Cleared on
 * unmount. No-op outside a host.
 */
export function useRailExitGuard(guard: PaneExitGuard | null): void {
  const ctx = useContext(RailHostContext);
  const registerExitGuard = ctx?.registerExitGuard;
  const id = useId();
  // The guard object identity changes every render (its `isDirty`/`save` close over fresh state),
  // so publishing it directly would loop. Keep the live guard in a ref and publish ONE STABLE proxy
  // that reads the ref, toggled only when the guard flips between present and absent.
  const ref = useRef<PaneExitGuard | null>(guard);
  ref.current = guard;
  const present = guard !== null;
  useEffect(() => {
    if (!registerExitGuard) return;
    registerExitGuard(
      id,
      present
        ? {
            // Reads the ref null-safely: `present` is a snapshot from the render that scheduled
            // this effect, so a guard withdrawn between render and invocation must not throw.
            isDirty: () => !!ref.current?.isDirty(),
          }
        : null,
    );
    return () => registerExitGuard(id, null);
  }, [registerExitGuard, id, present]);
}

/** The DOM node a feature editor should portal its action bar into, or null when there is no
 *  enclosing host (then the editor renders the bar inline, as before). */
export function useToolbarPortal(): HTMLElement | null {
  return useContext(RailHostContext)?.toolbarSlot ?? null;
}

/** Renders its children into the host's full-width button-bar slot (a portal) when inside a
 *  rail host; otherwise renders them inline. */
export function ToolbarPortal({ children }: { children: ReactNode }) {
  const slot = useToolbarPortal();
  return slot ? createPortal(children, slot) : <>{children}</>;
}
