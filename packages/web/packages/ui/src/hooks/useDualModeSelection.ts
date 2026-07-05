"use client";

import { useCallback, useState } from "react";

/** The opt-in URL-driven selection contract: the selected id lives in the URL (deep-linkable), and
 *  every change routes through `onSelect` so the caller pushes the route segment / search param. A
 *  component takes this as an optional prop; passing it flips the component from internal-state
 *  selection to URL-driven selection. */
export interface UrlSelection {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export interface DualModeSelection {
  /** The current selection — from the URL when URL-driven, else internal state. */
  selectedId: string | null;
  /** Set the selection: routes via `onSelect` when URL-driven, else writes internal state. */
  select: (id: string | null) => void;
  /** True when a `urlSelection` was supplied (the selection lives in the URL). Lets a caller keep
   *  the small amount of mode-specific behavior that legitimately remains — e.g. "don't clear the
   *  selection on create" (URL mode keeps the route put) vs. "deselect the master row" (internal
   *  mode). Reach for it only for that; reads/writes go through `selectedId` / `select`. */
  isUrlDriven: boolean;
}

/**
 * Dual-mode selection — the single representation of a toggle that was hand-rolled in
 * `useMasterDetailForm`, `StackGroupDetail`, and every deep-linkable feature panel (personas /
 * persona-services / research / messaging / persona-registry).
 *
 * A component is EITHER URL-driven (deep-linkable) OR internal-state, chosen by whether the caller
 * passes `urlSelection`. When present, the selected id lives in the URL: reads come from
 * `selectedId` and every change routes through `onSelect`. When absent, selection is internal
 * `useState`. Because reads go through the returned `selectedId` and writes through `select`, the
 * rest of the component is identical in both modes.
 *
 * `defaultSelectedId` seeds the INTERNAL selection only (an editor that opens on its first tab); it
 * is ignored when URL-driven, where the URL is the source of truth.
 */
export function useDualModeSelection(
  urlSelection: UrlSelection | undefined,
  options?: { defaultSelectedId?: string | null },
): DualModeSelection {
  const [internal, setInternal] = useState<string | null>(options?.defaultSelectedId ?? null);
  const onSelect = urlSelection?.onSelect;
  const select = useCallback(
    (id: string | null) => {
      if (onSelect) onSelect(id);
      else setInternal(id);
    },
    [onSelect],
  );
  return {
    selectedId: urlSelection ? urlSelection.selectedId : internal,
    select,
    isUrlDriven: urlSelection != null,
  };
}
