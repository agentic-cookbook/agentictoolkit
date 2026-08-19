"use client";

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

/**
 * The HOME BAR — the strip between the workspace bar and the breadcrumb bar, where a site's
 * page-level controls live: its search and filters on the left, its primary "Add" on the right.
 *
 * It is deliberately its OWN context rather than a field on {@link RailHostRegistry}, which is
 * where this mechanism started life as the "feature bar" (`FeatureBarPortal`, formerly in
 * `rail-host.tsx`). Two reasons, and the first is fatal: {@link RailHostBoundary} reads
 * {@link RailHostContext} to answer "is a host already above me?", and a shell-level provider of
 * that context would tell every feature site that one is — so each would skip its own
 * {@link StandaloneRailHost} and lose its rails entirely.
 * The second is that the bar and the rail host answer to different owners: the bar belongs to the
 * page's chrome (the home shell, the hub's workspace chrome), the rail host to whatever is drawing
 * rails underneath it.
 */
export interface HomeBarRegistry {
  /** Claim (true) / release (false) the bar, keyed by a stable publisher id. The host draws the
   *  strip — and so hands out {@link HomeBarRegistry.slot} — only while someone holds a claim,
   *  which is what keeps a site with no controls looking exactly as it did before this bar
   *  existed. */
  claim: (id: string, claimed: boolean) => void;
  /** The strip's DOM node. Null until a publisher claims it, and on a page with no host. */
  slot: HTMLElement | null;
}

export const HomeBarContext = createContext<HomeBarRegistry | null>(null);

/** The strip's node, or null when there is no host above (then a publisher renders inline). */
export function useHomeBarSlot(): HTMLElement | null {
  return useContext(HomeBarContext)?.slot ?? null;
}

/**
 * Hosts the home bar: draws the strip above `children` and hands out its node.
 *
 * Mounted by the two components that already draw the workspace bar — SiteHomeShell for the
 * templated fleet, and the hub's WorkspaceChromeProvider for the same features at the hub's own
 * routes. A feature must not mount one: two hosts in one page would give the nearer one the
 * claims and leave the outer strip empty.
 */
export function HomeBarHost({ children }: { children: ReactNode }): ReactElement {
  const [claims, setClaims] = useState<ReadonlySet<string>>(() => new Set());
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  const claim = useCallback((id: string, claimed: boolean) => {
    setClaims((prev) => {
      if (prev.has(id) === claimed) return prev;
      const next = new Set(prev);
      if (claimed) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const value = useMemo<HomeBarRegistry>(() => ({ claim, slot }), [claim, slot]);

  return (
    <HomeBarContext.Provider value={value}>
      {/* The strip's own classes are the ones the HTDV's feature bar wore, unchanged, so the
          bar keeps its exact appearance while changing owner. `w-full` on the inner row because
          the row is a flex container and a bar with a flexible space in it has to own the whole
          width to place anything at its right edge. */}
      {claims.size > 0 && (
        <div
          data-testid="home-bar"
          className="flex shrink-0 items-center gap-2 border-b border-apt-border bg-apt-bg px-4 py-2"
        >
          <div ref={setSlot} className="flex w-full items-center gap-2" />
        </div>
      )}
      {children}
    </HomeBarContext.Provider>
  );
}

/**
 * Publishes a feature's controls into the home bar. Claims the strip while mounted and portals
 * into it once the host hands out the node; renders inline when there is no host at all.
 *
 * The claim runs in a LAYOUT effect so claim → host draws the strip → ref → portal all settle in
 * one commit, and the bar is never painted where the feature sits and then moved a tick later.
 *
 * Note what a portal does and does not move: the children leave the feature's DOM subtree but
 * stay in its REACT tree, so they still read its context and still share its state. That is what
 * lets a control in the bar drive a list below it without lifting anything.
 */
export function HomeBarPortal({ children }: { children: ReactNode }): ReactNode {
  const ctx = useContext(HomeBarContext);
  const claim = ctx?.claim;
  const id = useId();
  useLayoutEffect(() => {
    if (!claim) return;
    claim(id, true);
    return () => claim(id, false);
  }, [claim, id]);
  const slot = ctx?.slot ?? null;
  if (slot) return createPortal(children, slot);
  // A host exists but has not handed out the node yet — this very render is the one that claims
  // it. Rendering inline for that beat would mount the bar in the wrong place and remount it
  // immediately. Only a page with NO host gets the inline fallback.
  return claim ? null : <>{children}</>;
}

/**
 * The bar's LAYOUT, and the one place the fleet rule lives: filters and search on the left, the
 * primary action right-justified. A feature passes its controls and does not restate the rule —
 * before this component every bar re-derived its own `ml-auto`, and they drifted.
 */
export function HomeBar({
  left,
  right,
}: {
  /** Search, filters, view toggles — anything that narrows or reshapes what is listed below. */
  left?: ReactNode;
  /** The page's primary action, typically its "New …" button. */
  right?: ReactNode;
}): ReactElement {
  return (
    <>
      {left !== undefined && (
        <div data-testid="home-bar-left" className="flex min-w-0 items-center gap-2">
          {left}
        </div>
      )}
      {right !== undefined && (
        <div data-testid="home-bar-right" className="ml-auto flex shrink-0 items-center gap-2">
          {right}
        </div>
      )}
    </>
  );
}
