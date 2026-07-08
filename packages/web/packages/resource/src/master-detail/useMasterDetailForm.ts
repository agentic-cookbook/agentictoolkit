"use client";

import { useEffect, useRef, useState } from "react";
import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";
import type { PaneExitGuard } from "@agentic-toolkit/ui/blocks";
import { useDualModeSelection } from "@agentic-toolkit/ui/hooks/useDualModeSelection";

import type { MasterDetailActions } from "./MasterDetailLayout";

/**
 * The shared master/detail editing state machine, extracted from the (formerly
 * copy-pasted) panes. The pane owns the data (fetch/refresh or props) and passes
 * the current `items` + the CRUD operations; this hook owns the selection +
 * lifted form `draft` + dirty/validity, returns a `MasterDetailActions` for the
 * button bar, and the props a controlled detail needs ({draft, onChange, error,
 * detailKey}).
 *
 * Bug fixes baked in here (so they hold for every feature at once):
 * - clears the form error on any edit (was only cleared on select/new/cancel/save),
 * - never dereferences a null `selected` on save (was `selected!.id` in some panes),
 * - normalizes (trims) the draft on save and re-hydrates from the saved entity,
 *   so a trailing-space edit doesn't leave the form stuck dirty.
 */
export interface MasterDetailFormConfig<TItem, TInput> {
  /** Current rows (null = still loading). */
  items: TItem[] | null;
  getId: (item: TItem) => string;
  blank: () => TInput;
  toInput: (item: TItem) => TInput;
  /** `others` = every row except the selected one (for uniqueness checks). */
  validate: (draft: TInput, others: TItem[]) => string | null;
  /** True when the draft differs from its baseline. */
  differs: (a: TInput, b: TInput) => boolean;
  /** Trim/clean the draft just before persisting. Defaults to identity. */
  normalize?: (draft: TInput) => TInput;
  create: (input: TInput) => Promise<TItem>;
  update: (id: string, input: TInput) => Promise<TItem>;
  /** Delete the row. Optional: panes that own delete elsewhere (e.g. an entity
   *  pane's Danger-zone DeleteEntitySection) omit it, and the hook's delete action
   *  becomes a no-op (it is never surfaced — those panes hide the delete button). */
  remove?: (item: TItem) => Promise<void>;
  /** Confirmation prompt shown before delete; required only when `remove` is set. */
  confirmDelete?: (item: TItem) => string;
  /** Re-read the list after a mutation (own fetch or a parent callback). */
  refresh: () => void | Promise<void>;
  createLabel: string;
  /** Opt-in URL-driven selection (the leaf level of a deep-linkable hierarchy). When
   *  provided, the selected id lives in the URL instead of internal state: the hook
   *  reads `selectedId` from here and routes every selection change (select / cancel /
   *  save-with-new-id / delete) through `onSelect` so the caller can push the route. A
   *  deep-link load or browser back/forward (an external `selectedId` change with no
   *  `select()` call) re-hydrates the draft via an effect. Omit for the legacy
   *  internal-selection behavior. */
  urlSelection?: {
    selectedId: string | null;
    onSelect: (id: string | null) => void;
  };
}

export interface MasterDetailForm<TItem, TInput> {
  selectedId: string | null;
  selected: TItem | null;
  creating: boolean;
  editing: boolean;
  /** True when the draft differs from its baseline (unsaved changes). */
  dirty: boolean;
  draft: TInput | null;
  error: string | null;
  /** Use as the detail component's React `key` so it remounts per record. */
  detailKey: string;
  onChange: (next: TInput) => void;
  /** Select a row by id (call from MasterDetailLayout's onSelect). */
  select: (id: string) => void;
  actions: MasterDetailActions;
  /** The package-level unsaved-work guard for the published-level / drill-down flow:
   *  `isDirty()` reads the current dirty state; `save()` persists and resolves true on success. */
  guard: PaneExitGuard;
}

export function useMasterDetailForm<TItem, TInput>(
  config: MasterDetailFormConfig<TItem, TInput>,
): MasterDetailForm<TItem, TInput> {
  // Selection lives in the URL when `urlSelection` is given (deep-linkable leaf), else in internal
  // state — the shared dual-mode toggle. `setSelection` writes to whichever owns it; reads go
  // through `selectedId` so the rest of the machine is identical for both modes. `url` is kept for
  // the few mode-specific spots (don't-clear-on-create, the deep-link re-hydrate effect).
  const url = config.urlSelection;
  const { selectedId, select: setSelection } = useDualModeSelection(url);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<TInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The row awaiting delete-confirmation (drives the shared AlertModal), and the
  // in-flight flag while the remove runs.
  const [pendingDelete, setPendingDelete] = useState<TItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const rows = config.items ?? [];
  const selected = selectedId
    ? (rows.find((r) => config.getId(r) === selectedId) ?? null)
    : null;
  const editing = creating || Boolean(selected);
  const base: TInput | null = creating
    ? config.blank()
    : selected
      ? config.toInput(selected)
      : null;
  const others = rows.filter((r) => config.getId(r) !== selectedId);

  const dirty = Boolean(draft) && Boolean(base) && config.differs(draft!, base!);
  const valid = Boolean(draft) && config.validate(draft!, others) === null;
  const canSave = dirty && valid && !saving;
  const canCancel = editing && !saving;
  const canDelete =
    Boolean(selected) && !creating && !saving && !deleting && Boolean(config.remove);
  const detailKey = creating ? "__new__" : (selectedId ?? "none");

  // For URL-driven selection: the id whose draft is currently loaded, so the sync
  // effect below re-hydrates only on an EXTERNAL selection change (deep-link / browser
  // back), never re-clobbering a draft that `select`/`save` already loaded for that id.
  const loadedIdRef = useRef<string | null | undefined>(undefined);

  function onChange(next: TInput) {
    setDraft(next);
    if (error) setError(null); // clear stale validation error as the user edits
  }

  function select(id: string) {
    const row = rows.find((r) => config.getId(r) === id) ?? null;
    setCreating(false);
    setSelection(id);
    setDraft(row ? config.toInput(row) : null);
    setError(null);
    loadedIdRef.current = id;
  }

  function create() {
    // URL-driven mode: do NOT route on create. A new record has no id yet, and pushing
    // a leaf-less URL would remount the pane (Next re-renders the catch-all route),
    // discarding the just-set `creating`/`draft`. Instead keep the URL put and rely on
    // the returned `selectedId` going null (below) to deselect the master row; `save`
    // routes to the created id. Internal mode still clears its own selection here.
    if (!url) setSelection(null);
    setCreating(true);
    setDraft(config.blank());
    setError(null);
    loadedIdRef.current = null;
  }

  function cancel() {
    setCreating(false);
    setSelection(null);
    setDraft(null);
    setError(null);
    loadedIdRef.current = null;
  }

  // URL-driven mode only: when the selected id changes from OUTSIDE the hook (a
  // deep-link landing or browser back/forward — `select` wasn't called, so the draft
  // is stale), re-hydrate the draft from the now-selected row. Waits for the row to
  // load (the list may still be fetching) and never disturbs an in-progress create.
  useEffect(() => {
    if (!url || creating) return;
    if (selectedId === loadedIdRef.current) return;
    const row = selectedId
      ? ((config.items ?? []).find((r) => config.getId(r) === selectedId) ?? null)
      : null;
    if (selectedId && !row) return; // row not loaded yet — try again on next items change
    setDraft(row ? config.toInput(row) : null);
    setError(null);
    loadedIdRef.current = selectedId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url ? selectedId : null, config.items, creating]);

  // Returns true on a successful persist (so the exit guard may proceed), false if validation
  // failed or the request threw (the editor stays open with its error shown).
  async function save(): Promise<boolean> {
    if (!draft) return true;
    const problem = config.validate(draft, others);
    if (problem) {
      setError(problem);
      return false;
    }
    const input = config.normalize ? config.normalize(draft) : draft;
    setError(null);
    setSaving(true);
    try {
      if (creating) {
        const created = await config.create(input);
        await config.refresh();
        setCreating(false);
        loadedIdRef.current = config.getId(created);
        setSelection(config.getId(created));
        setDraft(config.toInput(created));
      } else if (selected) {
        const updated = await config.update(config.getId(selected), input);
        await config.refresh();
        // An update can change the id (e.g. an editable rdid that IS the id):
        // re-point the selection at the new id so `selected` still resolves against
        // the refreshed list — otherwise the form blanks to its empty state until a
        // navigation remounts the pane.
        loadedIdRef.current = config.getId(updated);
        setSelection(config.getId(updated));
        setDraft(config.toInput(updated));
      }
      return true;
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "master-detail-form", step: "save" });
      setError(err instanceof Error ? err.message : "Failed to save.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  // Delete is a two-step flow so the confirmation is our shared AlertModal, not a
  // native confirm(): the button REQUESTS (opens the modal), the modal's primary
  // action PERFORMS the remove. ButtonBar renders the modal from these.
  function requestDelete() {
    if (!selected || !config.remove || !config.confirmDelete) return;
    setPendingDelete(selected);
  }

  function cancelDelete() {
    if (deleting) return; // modal is non-dismissable mid-delete
    setPendingDelete(null);
  }

  async function performDelete() {
    const target = pendingDelete;
    if (!target || !config.remove) return;
    setDeleting(true);
    try {
      await config.remove(target);
      setPendingDelete(null);
      loadedIdRef.current = null;
      setSelection(null);
      setDraft(null);
      await config.refresh();
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "master-detail-form", step: "delete" });
      setError(err instanceof Error ? err.message : "Failed to delete.");
      setPendingDelete(null); // close the modal so the form-level error is visible
    } finally {
      setDeleting(false);
    }
  }

  return {
    // While creating, report no selection so the master list highlights nothing — in
    // URL-driven mode the route still carries the previously-selected id (we don't
    // navigate on create), so suppress it here rather than in the route.
    selectedId: creating ? null : selectedId,
    selected,
    creating,
    editing,
    dirty,
    draft,
    error,
    detailKey,
    onChange,
    select,
    // The package-level guard: read dirty fresh on each call (the hook re-creates this object every
    // render, so the closed-over `dirty`/`save` are always current).
    guard: { isDirty: () => dirty, save },
    actions: {
      onCreate: create,
      createLabel: config.createLabel,
      onCancel: cancel,
      canCancel,
      onSave: save,
      canSave,
      saving,
      onDelete: requestDelete,
      canDelete,
      // Delete-confirm modal (rendered by ButtonBar): null prompt = closed.
      deletePrompt:
        pendingDelete && config.confirmDelete ? config.confirmDelete(pendingDelete) : null,
      onConfirmDelete: performDelete,
      onCancelDelete: cancelDelete,
      deleting,
    },
  };
}
