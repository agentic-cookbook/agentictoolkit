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
 * page's chrome (the home shell, the hub's workspace shell), the rail host to whatever is drawing
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

/**
 * Is the bar already spoken for by a publisher ABOVE this point in the tree?
 *
 * The bar is the PAGE's strip, and a page has one. But features nest: an organizations
 * {@link ResourceExplorer} renders a teams one inside its topic pane, and the hub's Products list
 * mounts a whole projects feature under itself. Without this, both explorers claim, both portal
 * into the same node, and their controls interleave — the outer one's `ml-auto` eats every pixel of
 * slack, so the inner one's filter lands hard against the right edge next to a create button for a
 * different resource. Nothing errors and nothing is missing; it just reads as one incoherent bar.
 *
 * The OUTER publisher wins, because the bar acts on the page and the page is the outer list. The
 * winner cannot be settled by claim order: layout effects run child-first, so the inner publisher
 * always claims first, and a Set of ids does not remember who was there before. Depth is the only
 * thing the tree knows at render time, hence a context rather than a registry rule.
 */
const HomeBarTakenContext = createContext(false);

/**
 * Marks a subtree as standing below a publisher, so any {@link HomeBarPortal} inside it stands down
 * to its inline fallback rather than claiming the page's bar.
 *
 * A publisher wraps whatever it renders BELOW its own portal — never the portal itself, which is
 * its sibling. `taken={false}` passes through unchanged, which is what lets a conditional publisher
 * (an explorer with nothing to publish yet) leave the bar to the feature it hosts.
 */
export function HomeBarTaken({
  taken = true,
  children,
}: {
  taken?: boolean;
  children: ReactNode;
}): ReactElement {
  const above = useContext(HomeBarTakenContext);
  // `above || taken`, not `taken`: a nested provider must never HAND BACK a bar an ancestor holds.
  const value = above || taken;
  return <HomeBarTakenContext.Provider value={value}>{children}</HomeBarTakenContext.Provider>;
}

/**
 * Hosts the home bar: draws the strip above `children` and hands out its node.
 *
 * Mounted by the two components that already draw the workspace bar — SiteHomeShell for the
 * templated fleet, and WorkspaceShellInner for the same features at the hub's own routes. A
 * feature must not mount one: two hosts in one page would give every claim below to the nearer
 * one, and a host with no claims draws NOTHING (see the `claims.size > 0` guard below) — so the
 * outer host would silently stop drawing a strip at all, and the bar would appear in the inner
 * host's position instead of the page's.
 *
 * `placeholder` opts a host OUT of that "draws nothing" default: pass it and the strip is always
 * there, showing the placeholder while nobody has claimed it. That is what the hub's workspace
 * shell wants — every one of its 45 routes then has the same chrome, so moving between a feature
 * that publishes controls and one that does not stops shifting everything below it by the height
 * of a bar. It is opt-in rather than the rule because the same host sits above every fleet site's
 * home, and most of those genuinely have no controls to promise.
 */
export function HomeBarHost({
  children,
  placeholder,
}: {
  children: ReactNode;
  /** Drawn in the strip while no publisher holds a claim. Omit to keep the strip absent instead. */
  placeholder?: ReactNode;
}): ReactElement {
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
      {/* The strip wears the classes the HTDV's `toolbar` strip wears
          (`hierarchical-topic-detail.tsx:196`), unchanged, so the bar keeps its exact appearance
          while changing owner — `--adh-chrome-bar-height` included, which is what makes this bar
          exactly as tall as the breadcrumb under it whether a feature publishes a search field or
          a single button. `w-full` on the inner row because the row is a flex container and a bar
          with a flexible space in it has to own the whole width to place anything at its right
          edge. */}
      {(claims.size > 0 || placeholder !== undefined) && (
        <div
          data-testid="home-bar"
          className="flex min-h-[var(--adh-chrome-bar-height,2.75rem)] shrink-0 items-center gap-2 border-b border-apt-border bg-apt-bg px-4 py-1"
        >
          {/* Before the slot, so the placeholder reads from the left edge like a feature's search
              does. The slot's `w-full` still shrinks around it (flex items shrink by default), and
              the moment anyone claims, the placeholder is gone and the slot has the row to itself
              again — so a publisher's right-justified action lands exactly where it always has.

              `shrink-0 whitespace-nowrap` on the wrapper because the slot beside it is `w-full`:
              a flex item asking for the whole row squeezes its sibling down to min-content, and
              two words of placeholder then wrap onto two lines and push the bar TALLER than
              `--adh-chrome-bar-height`. The wrapper belongs here rather than in what a host
              passes, because the squeeze is a fact about this row, not about the node. */}
          {claims.size === 0 && placeholder !== undefined ? (
            <div className="shrink-0 whitespace-nowrap">{placeholder}</div>
          ) : null}
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
 *
 * Under a {@link HomeBarTaken} subtree it neither claims nor portals: the outer publisher owns the
 * page's bar, so these controls render INLINE where the feature sits — the same fallback a page
 * with no host gets. Nested controls stay reachable; they just stop fighting for the strip.
 */
export function HomeBarPortal({ children }: { children: ReactNode }): ReactNode {
  const ctx = useContext(HomeBarContext);
  const taken = useContext(HomeBarTakenContext);
  const claim = taken ? undefined : ctx?.claim;
  const id = useId();
  useLayoutEffect(() => {
    if (!claim) return;
    claim(id, true);
    return () => claim(id, false);
  }, [claim, id]);
  const slot = claim ? (ctx?.slot ?? null) : null;
  if (slot) return createPortal(children, slot);
  // A host exists, we are claiming it, and it has not handed out the node yet — this very render
  // is the one that claims. Rendering inline for that beat would mount the bar in the wrong place
  // and remount it immediately. The inline fallback is for the two cases where we never claim at
  // all: no host above, or the bar already taken by a publisher above (`claim` is undefined for
  // both, which is why the one check covers them).
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
    // Its OWN row, rather than trusting the strip it lands in to be one. Inside the host the strip
    // is already a flex row, so this changes nothing there; but a publisher standing down under
    // {@link HomeBarTaken}, or one on a page with no host at all, renders these same children into
    // whatever container the feature happens to sit in — usually a `flex-col`, which stacks the two
    // sides vertically and leaves `ml-auto` doing nothing. The rule the component exists to own —
    // filters left, primary action right — has to travel with the markup, not with the host.
    <div className="flex w-full min-w-0 items-center gap-2">
      {/* Truthiness, not `!== undefined`: a caller's natural `side={condition && <X/>}` hands
          this `false` when `condition` is false, and an empty slot div is NOT nothing — it is a
          flex item in a `gap-2` row, so an empty `left` pushes the right cluster over by the gap,
          and an empty `right` puts an `ml-auto` spacer where no control is. Silent, and visible
          only by measuring. Every caller reaches these slots through this same API — the two in
          this package (`ResourceExplorer`, `ResourceLanding`) and anyone downstream, since
          `HomeBar` is exported from the barrel — so the check belongs here, once, rather than in
          each caller's own gate.

          A ternary rather than `&&`, because `&&` does not discard every falsy value: `0` and
          `NaN` are returned as-is and React renders them as a bare text node, here directly
          inside the strip, outside both slot divs and outside the `ml-auto` arrangement this
          component owns. A downstream `left={items.length && <Chip/>}` would print a `0` where
          the filter belongs. The ternary renders nothing for all of them. */}
      {left ? (
        <div data-testid="home-bar-left" className="flex min-w-0 items-center gap-2">
          {left}
        </div>
      ) : null}
      {right ? (
        <div data-testid="home-bar-right" className="ml-auto flex shrink-0 items-center gap-2">
          {right}
        </div>
      ) : null}
    </div>
  );
}
