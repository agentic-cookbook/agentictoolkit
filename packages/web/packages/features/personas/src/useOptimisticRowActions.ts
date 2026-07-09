"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The persona-facet load/mutate machine shared by AbilitiesPanel (tool grants) and
 * PermissionsPanel (the may_act toggles + the approvals queue) — extracted from the two
 * byte-for-byte-duplicated copies each panel used to hand-roll (#11).
 *
 * A `key`-keyed (a `personaId`) list of rows, loaded via `load(key)` and reset whenever `key`
 * changes, with a monotonic "load token" stale-response guard:
 *  - a persona switch (`key` change) bumps the token and resets busy + rows, so an in-flight
 *    `load()` for the ABANDONED key that resolves LATER is dropped (its captured token no longer
 *    matches `loadToken.current`), never overwriting the newly-selected key's rows;
 *  - a row mutation fired via `runRowMutation` captures `loadToken.current` at FIRE time and
 *    gates its reconcile/revert/busy-clear the same way, so a mutation that settles AFTER a
 *    switch never writes into a different key's rows. A caller with a bespoke mutation shape
 *    (PermissionsPanel's decide(), which REMOVES a row and refetches rather than patching one)
 *    does the same gating by hand using the exposed `loadToken` ref + `isCurrent`.
 *
 * Busy rows are tracked as a `Set<Id>`, not one shared flag, so independent rows can be
 * concurrently in flight without blocking each other — mirrors both panels' original
 * `busyTools`/`decisionBusy` sets.
 *
 * `load`/`getId` are read from refs updated every render, so a caller does not need to memoize
 * them for the reload effect to stay keyed on `key` alone (it never re-fires just because a
 * fresh closure was passed in).
 */
export function useOptimisticRowActions<Row, Id extends string = string>(
  key: string,
  load: (key: string) => Promise<Row[]>,
  getId: (row: Row) => Id,
) {
  const loadRef = useRef(load);
  loadRef.current = load;
  const getIdRef = useRef(getId);
  getIdRef.current = getId;

  const [rows, setRows] = useState<Row[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusyState] = useState<ReadonlySet<Id>>(() => new Set<Id>());
  // Monotonic load token: every `key` change bumps it, so an older in-flight load — or a
  // mutation's optimistic revert/reconcile — that resolves LATER is recognised as stale and
  // dropped rather than written into whichever key is now selected.
  const loadToken = useRef(0);

  const setBusy = useCallback((id: Id, isBusy: boolean) => {
    setBusyState((prev) => {
      if (isBusy === prev.has(id)) return prev;
      const next = new Set(prev);
      if (isBusy) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const resetBusy = useCallback(() => setBusyState(new Set<Id>()), []);

  useEffect(() => {
    const token = ++loadToken.current;
    resetBusy(); // a switch abandons any prior key's in-flight rows
    setRows(null);
    setLoadError(null);
    if (!key) return;
    loadRef
      .current(key)
      .then((next) => {
        if (loadToken.current === token) setRows(next);
      })
      .catch((e) => {
        if (loadToken.current === token) {
          setLoadError(e instanceof Error ? e.message : String(e));
          setRows([]);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const patchRow = useCallback((id: Id, next: Row) => {
    setRows((prev) => (prev ? prev.map((r) => (getIdRef.current(r) === id ? next : r)) : prev));
  }, []);

  const removeRow = useCallback((id: Id) => {
    setRows((prev) => (prev ? prev.filter((r) => getIdRef.current(r) !== id) : prev));
  }, []);

  /** Whether `token` (captured earlier via `loadToken.current`) is still the live one. */
  const isCurrent = useCallback((token: number) => loadToken.current === token, []);

  // The one optimistic row-mutation shape both panels' toggles share: mark the row busy, apply
  // the optimistic patch, fire `apiCall` via the caller's OWN `run` (its own useAction instance,
  // so each mutation kind keeps its own busy/error), then settle. On success `apiCall` may return
  // a reconciled row (the server's authoritative version) to write over the optimistic guess — a
  // falsy return (void) keeps the optimistic guess as-is. On failure the prior `row` is restored.
  // BOTH the reconcile and the revert are gated by the load token captured at fire time, so a
  // mutation that resolves AFTER a key switch never writes into a different key's rows.
  // `finally` clears only THIS row's busy entry, likewise gated.
  const runRowMutation = useCallback(
    (
      row: Row,
      optimistic: Row,
      apiCall: () => Promise<Row | void>,
      run: (action: () => Promise<void>) => void | Promise<void>,
    ) => {
      const token = loadToken.current;
      const id = getIdRef.current(row);
      setBusy(id, true);
      patchRow(id, optimistic);
      void run(async () => {
        try {
          const reconciled = await apiCall();
          if (reconciled && loadToken.current === token) patchRow(id, reconciled);
        } catch (e) {
          if (loadToken.current === token) patchRow(id, row);
          throw e;
        } finally {
          if (loadToken.current === token) setBusy(id, false);
        }
      });
    },
    [setBusy, patchRow],
  );

  return {
    rows,
    setRows,
    loadError,
    busy,
    setBusy,
    resetBusy,
    loadToken,
    isCurrent,
    patchRow,
    removeRow,
    runRowMutation,
  };
}
