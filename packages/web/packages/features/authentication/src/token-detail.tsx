"use client";

import { useCallback, useSyncExternalStore, type ReactNode } from "react";

/**
 * The two pieces of a token detail leaf that both families render identically: the fact list and
 * the one-time secret reveal. Shared so the reveal's promise ("shown once") is worded once — the
 * two sections mint different principals, but the guarantee is the same sentence and must not
 * drift into two.
 */

/** One label/value row. `value` is null/undefined for "not set", rendered as an em dash. */
export function TokenFact({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  /** Render the value in the mono face — for ids, prefixes and rdids. */
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-mono text-[0.7rem] uppercase tracking-wider text-apt-text-muted">
        {label}
      </dt>
      <dd className={`break-all text-sm text-apt-text${mono ? " font-mono" : ""}`}>
        {value == null || value === "" ? "—" : value}
      </dd>
    </div>
  );
}

export function TokenFacts({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</dl>;
}

/** A timestamp as a local string, or the caller's word for "never". */
export function whenOr(iso: string | null | undefined, never: string): string {
  return iso ? new Date(iso).toLocaleString() : never;
}

/**
 * The minted secret, shown ONCE. Rendered inside the detail of the token it belongs to, and only
 * for that token: a reveal that outlives its row would sit next to a different token's facts and
 * invite the reader to attribute it there.
 */
export function RevealedSecret({ secret }: { secret: string }) {
  return (
    <p className="break-all rounded-md border border-apt-gold/40 bg-apt-gold/10 p-3 text-sm">
      Copy now — shown once: <code className="font-mono">{secret}</code>
    </p>
  );
}

/** surface key → the secret minted on it. Module scope, deliberately — see {@link useMintedSecret}. */
const mintedBySurface = new Map<string, { id: string; secret: string }>();
const mintedListeners = new Set<() => void>();

function publishMinted() {
  for (const listener of mintedListeners) listener();
}

function subscribeMinted(onChange: () => void) {
  mintedListeners.add(onChange);
  return () => {
    mintedListeners.delete(onChange);
  };
}

/**
 * Hold the one-time secret OUTSIDE React state, keyed by surface.
 *
 * The backend returns a minted token's raw value exactly once, and the mint handler navigates the
 * instant it has it — `leaf.onSelect(id)` pushes `…/<section>/<id>`, a change to the route's
 * catch-all param. That remounts the whole page subtree (Next.js keys each rendered segment by its
 * cache key, and the joined param IS that key), so a `useState` holding the secret is reinitialised
 * by the very click that is supposed to reveal it — the credential is gone, unrecoverably. The
 * hierarchical-detail frame already documents this for its own selection state ("a route change
 * remounts this whole subtree — component state would be destroyed by the very click that must not
 * disturb it"); a minted secret has strictly less tolerance for it.
 *
 * A module Map survives the remount and dies with the tab, which is the right lifetime: the value
 * is worthless to a later session and must never be persisted anywhere a later session could read.
 * Keyed by surface so the two token families cannot show each other's secret.
 *
 * Callers must still gate the render on `minted.id === <the id the URL names>` — this hook keeps
 * the secret alive, it does not decide where it belongs.
 */
export function useMintedSecret(surface: string): {
  minted: { id: string; secret: string } | null;
  remember: (minted: { id: string; secret: string }) => void;
  forget: () => void;
} {
  const minted = useSyncExternalStore(
    subscribeMinted,
    () => mintedBySurface.get(surface) ?? null,
    () => null,
  );
  const remember = useCallback(
    (next: { id: string; secret: string }) => {
      mintedBySurface.set(surface, next);
      publishMinted();
    },
    [surface],
  );
  const forget = useCallback(() => {
    if (mintedBySurface.delete(surface)) publishMinted();
  }, [surface]);
  return { minted, remember, forget };
}

/**
 * Does the URL name a token the list does not contain? Then the detail pane has nothing to draw
 * and the frame will not help: a non-null `selectedId` means this level is NOT the unselected
 * frontier, so the "choose a token" nudge is suppressed and the reader gets blank space.
 *
 * Both "still loading" cases are excluded, and `isFetching` — not `isPending` — is the one to ask:
 * a revisit with cached data is never pending, so `isPending` would let this message flash over a
 * list that is about to arrive. The freshly minted id is excluded for the same reason, since the
 * invalidation that will include it is in flight when the detail first renders.
 */
export function isMissingToken(args: {
  leafId: string | null | undefined;
  found: boolean;
  isFetching: boolean;
  isError: boolean;
  mintedId: string | null | undefined;
}): boolean {
  const { leafId, found, isFetching, isError, mintedId } = args;
  if (!leafId || found || isFetching || isError) return false;
  return mintedId !== leafId;
}

/** The message {@link isMissingToken} decides to show. `noun` is the level's own `itemNoun`. */
export function MissingToken({ noun }: { noun: string }) {
  return (
    <p role="status" className="text-sm text-apt-text-muted">
      That {noun} is no longer listed — it may have been revoked, or belong to someone else. Choose
      one from the list.
    </p>
  );
}
