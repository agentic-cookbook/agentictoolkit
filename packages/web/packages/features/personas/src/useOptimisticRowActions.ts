"use client";

import { useCallback, useRef, useState } from "react";
import { revalidateResources, useResourceList } from "@agentic-toolkit/data";

/**
 * The persona-facet load/mutate machine shared by AbilitiesPanel (tool grants) and
 * PermissionsPanel (the may_act toggles + the approvals queue) — extracted from the two
 * byte-for-byte-duplicated copies each panel used to hand-roll (#11).
 *
 * A `key`-keyed (a `personaId`) list of rows, read through `useResourceList` under
 * `<cacheName>:<key>` — so reopening a persona paints its tools, switches and queue from what was
 * already fetched and revalidates behind that paint, instead of blanking to "Loading…" on every
 * click through the persona list. `cacheName` is what keeps the three instances apart: all three
 * are keyed by the SAME personaId, and a shared entry would hand the approvals queue the tool
 * catalog.
 *
 * WHAT THE CACHE KEY ALREADY SETTLES. A read can only ever land on the entry it was made for, so a
 * slow response for an abandoned persona is not a hazard to guard against — it lands under that
 * persona, where it is correct, and the rows on screen come from the key currently selected.
 *
 * WHAT IT DOESN'T. A MUTATION still needs guarding, because its writes go to whatever entry is
 * current when it settles, not the one it was fired against. So each mutation takes a
 * {@link RowClaim} at fire time and writes only while that claim holds:
 *  - `runRowMutation` gates its reconcile, its revert and its busy-clear on the claim, so a grant
 *    that settles after a persona switch never patches a different persona's rows and never
 *    re-enables a row whose own request is still in flight;
 *  - a caller with a bespoke mutation shape (PermissionsPanel's decide(), which REMOVES a row and
 *    re-reads rather than patching one) takes its own claim and does the same.
 *
 * A claim that no longer holds is DROPPED, and dropping is not the same as doing nothing: the
 * optimistic patch is already in the cache under the abandoned persona, and the settle that would
 * have corrected it is the one being discarded. `RowClaim.drop` marks that entry stale, so coming
 * back to that persona re-reads rather than serving a guess for the rest of the staleness window.
 *
 * Busy rows are tracked as a `Set<Id>`, not one shared flag, so independent rows can be
 * concurrently in flight without blocking each other — mirrors both panels' original
 * `busyTools`/`decisionBusy` sets.
 *
 * `load`/`getId` are read from refs updated every render, so a caller does not need to memoize
 * them. That is also what lets this hook hand `useResourceList` a fetcher of ONE identity for the
 * lifetime of the mount, which is what that hook requires: the scope lives in the cache key, and a
 * fresh closure per render must not read as "the scope changed, read again".
 */
export function useOptimisticRowActions<Row, Id extends string = string>(
  cacheName: string,
  key: string,
  load: (key: string) => Promise<Row[]>,
  getId: (row: Row) => Id,
) {
  const loadRef = useRef(load);
  loadRef.current = load;
  const getIdRef = useRef(getId);
  getIdRef.current = getId;
  const keyRef = useRef(key);
  keyRef.current = key;

  const cacheKey = `${cacheName}:${key}`;
  const cacheKeyRef = useRef(cacheKey);
  cacheKeyRef.current = cacheKey;

  // Stable for the life of the mount, deliberately — see the class comment. It reads the CURRENT
  // key rather than closing over one, and a key change reaches it through the cache key above.
  const fetcher = useCallback(
    // No key yet means no scope to read: hold in Loading rather than asking for the whole set,
    // which is what the old effect's `if (!key) return` did by leaving rows null forever.
    () => (keyRef.current ? loadRef.current(keyRef.current) : new Promise<Row[]>(() => {})),
    [],
  );
  const {
    items: rows,
    setItems: setRows,
    error: loadError,
    reload,
  } = useResourceList<Row>(cacheKey, fetcher);

  const [busy, setBusyState] = useState<ReadonlySet<Id>>(() => new Set<Id>());
  // Monotonic claim token: every `key` change bumps it, so a mutation's optimistic revert,
  // reconcile or busy-clear that resolves LATER is recognised as belonging to an abandoned scope
  // and dropped rather than written into whichever key is now selected.
  const claimToken = useRef(0);

  // A key change resets busy DURING THE RENDER, not in an effect. The rows for the new key arrive
  // on this same frame when they are cached, and a busy entry carried one frame past them would
  // disable a row of the new persona's that has nothing in flight.
  const [scopeKey, setScopeKey] = useState(key);
  if (scopeKey !== key) {
    setScopeKey(key);
    ++claimToken.current;
    setBusyState(new Set<Id>());
  }

  const setBusy = useCallback((id: Id, isBusy: boolean) => {
    setBusyState((prev) => {
      if (isBusy === prev.has(id)) return prev;
      const next = new Set(prev);
      if (isBusy) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const patchRow = useCallback((id: Id, next: Row) => {
    setRows((prev) => (prev ? prev.map((r) => (getIdRef.current(r) === id ? next : r)) : prev));
  }, [setRows]);

  const removeRow = useCallback((id: Id) => {
    setRows((prev) => (prev ? prev.filter((r) => getIdRef.current(r) !== id) : prev));
  }, [setRows]);

  /**
   * A mutation's licence to write, taken at FIRE time. See the class comment for why a mutation
   * needs one and a read does not.
   */
  const claim = useCallback((): RowClaim => {
    const token = claimToken.current;
    const firedAgainst = cacheKeyRef.current;
    return {
      holds: () => claimToken.current === token,
      drop: () => revalidateResources((k) => k === firedAgainst),
    };
  }, []);

  // The one optimistic row-mutation shape both panels' toggles share: mark the row busy, apply
  // the optimistic patch, fire `apiCall` via the caller's OWN `run` (its own useAction instance,
  // so each mutation kind keeps its own busy/error), then settle. On success `apiCall` may return
  // a reconciled row (the server's authoritative version) to write over the optimistic guess — a
  // falsy return (void) keeps the optimistic guess as-is. On failure the prior `row` is restored.
  // BOTH the reconcile and the revert are gated by the claim taken at fire time, so a mutation
  // that resolves AFTER a key switch never writes into a different key's rows. `finally` clears
  // only THIS row's busy entry, likewise gated — and a settle the claim refuses drops it, so the
  // scope it patched optimistically re-reads instead of keeping the guess.
  const runRowMutation = useCallback(
    (
      row: Row,
      optimistic: Row,
      apiCall: () => Promise<Row | void>,
      run: (action: () => Promise<void>) => void | Promise<void>,
    ) => {
      const held = claim();
      const id = getIdRef.current(row);
      setBusy(id, true);
      patchRow(id, optimistic);
      void run(async () => {
        try {
          const reconciled = await apiCall();
          if (reconciled && held.holds()) patchRow(id, reconciled);
        } catch (e) {
          if (held.holds()) patchRow(id, row);
          throw e;
        } finally {
          if (held.holds()) setBusy(id, false);
          else held.drop();
        }
      });
    },
    [claim, setBusy, patchRow],
  );

  // Only what a panel actually consumes. `setRows` and `patchRow` are the machinery `removeRow`
  // and `runRowMutation` are built from, and handing them out too would offer a second, ungated
  // way to write into rows — the exact thing the claim above exists to prevent.
  return { rows, loadError, reload, busy, setBusy, claim, removeRow, runRowMutation };
}

/** A mutation's licence to write into the rows it was fired against — see {@link useOptimisticRowActions}. */
export interface RowClaim {
  /** Is the scope this mutation was fired against still the selected one? */
  holds(): boolean;
  /** Give up a settle `holds()` refused, marking the entry it was fired against stale so the scope
   *  it optimistically patched re-reads on its next visit instead of serving the guess. */
  drop(): void;
}
