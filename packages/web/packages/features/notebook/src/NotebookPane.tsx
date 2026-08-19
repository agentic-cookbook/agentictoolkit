"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Boxes, Folder, Inbox, LayoutList, NotebookPen } from "lucide-react";

import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";
import { AlertModal } from "@agentic-toolkit/ui/components/alert-modal";
import type { CategoryTreeNode } from "@agentic-toolkit/ui/blocks/category-field";
import type { TopicDetailItem, TopicLevel } from "@agentic-toolkit/ui/blocks";
import {
  StackLevels,
  useRailExitGuard,
  MasterDetailLeaf,
  useRecordAffordance,
  CreateResourceDialog,
  HomeBarPortal,
  useResourceItem,
  type MasterDetailActions,
} from "@agentic-toolkit/resource";
import {
  revalidateResources,
  useResourceItemPrefetch,
  useResourceItemWriter,
  useResourceList,
} from "@agentic-toolkit/data";
import { ecosystemsApi, type Ecosystem } from "@agentic-toolkit/data/ecosystems";
import {
  notesApi,
  taxonomyApi,
  type Note,
  type NoteCategory,
  type NoteSummary,
  type NoteTag,
} from "@agentic-toolkit/data/notes";
import {
  buildCategoryTree,
  categoryNames,
  resolveCategoryChain,
  type CategoryNode,
} from "./category-tree";
import {
  noteBlank,
  noteDiffers,
  noteNormalize,
  noteToInput,
  noteValidate,
  resolveListCategory,
  toCreateBody,
  toUpdateBody,
  type CategoryScope,
  type NoteInput,
} from "./note-model";
import { ALL_CATEGORIES_ID, UNCATEGORIZED_SLUG } from "./parse-path";
import { usePreviewLines } from "./preview-lines";
import { NoteDetail, NoteFields } from "./NoteDetail";
import { NoteButtonBar, type FilterState } from "./NoteButtonBar";
import { NoteListOptions } from "./NoteListOptions";
import { CategoryManagerDialog } from "./CategoryManagerDialog";
import { TagManagerDialog } from "./TagManagerDialog";

const EMPTY_FILTERS: FilterState = { q: "", category: "", tag: "" };

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/** Value equality for the filter triple. A filter typed and then retyped back to what it already
 *  was must keep the SAME applied object: a new fetcher identity is `useResourceList`'s refetch
 *  signal, and that one would spend a request to arrive back at rows already on screen. */
function sameFilters(a: FilterState, b: FilterState): boolean {
  return a.q === b.q && a.category === b.category && a.tag === b.tag;
}

/**
 * The notebook workspace: a master/detail surface over the owner's notes, browsed through
 * a hierarchical category rail.
 *
 * The research pane is this pane's ancestor and the resemblance is deliberate — a note IS a
 * markdown document (same head, same versions, same category + tags), so the editor, the
 * dirty/validity machinery and the delete confirm are the same knowledge. Two differences
 * are the whole feature:
 *
 *  1. **No publishing.** A note has no public route, no visibility, and no publish section.
 *  2. **The category list is a TREE, and it is the rail.** Research publishes one flat
 *     document level; this publishes a read-only ecosystems level, then one level per
 *     category depth, then the notes. Selecting a category narrows the notes to the ones
 *     filed DIRECTLY in it — its subcategories are the next rail level, exactly as a folder
 *     holds its own files and its subfolders hold theirs. With nothing selected the list is
 *     the whole notebook, which is the useful landing: you open the notebook and see your
 *     notes, not an empty pane demanding a folder.
 *
 * Everything that acts on the LIST rather than on one note lives in {@link NoteButtonBar},
 * published into the host's feature-bar slot — search, the two filters, the two taxonomy
 * editors and Create Note. The rail's headers hold nothing but navigation, so the only `+`
 * left in the notebook is the one that creates a category from inside the category editor.
 *
 * The rail and the bar both speak about categories, and they are NOT the same axis: the rail
 * SCOPES (which part of the notebook you are standing in) while the bar NARROWS within it.
 * `resolveListCategory` folds the two into one request and reports the contradiction rather
 * than letting either quietly win.
 *
 * Routing is the caller's (see NotebookFeature): this pane takes the selection and two
 * navigate callbacks, so it can be driven and tested without a router.
 */
export function NotebookPane({
  categorySlugs,
  noteId,
  onSelectCategory,
  onSelectNote,
  workspaceSlug,
}: {
  /** The selected category chain from the URL, outermost first. */
  categorySlugs: string[];
  /** The open note's id, or undefined for the bare list. */
  noteId?: string;
  /** Navigate to a category chain (an empty array is the whole notebook). Closes any
   *  open note, since the note's URL hangs below the chain. */
  onSelectCategory: (slugs: string[]) => void;
  /** Open a note (null closes it) under `slugs`. The chain is passed rather than implied
   *  because the pane navigates from the RESOLVED chain, never the raw URL — so opening a
   *  note off a stale deep link rewrites the dead segments away instead of carrying them. */
  onSelectNote: (id: string | null, slugs: string[]) => void;
  /** Pins every op to the WORKSPACE'S owning principal (backend `?workspace=`), so an org
   *  workspace shows the ORG's notes and creates org-owned ones. Omitted: the caller's.
   *
   *  This is the whole of the ownership story for an org today: an org note is a document
   *  the org owns, and the `content.notes` marker that files it in the org's `notes` bucket
   *  carries only its creator's stamp. Org-SHARED note semantics are still undesigned — the
   *  placeholder is deliberate, and it lives at this one seam. */
  workspaceSlug?: string;
}) {
  // ── Data ────────────────────────────────────────────────────────────────
  // Two filter values, not one. `filters` is what the button bar shows and changes on every
  // keystroke; `applied` is what the list READS, and lags it by the debounce. The debounce used
  // to sit on the request; it now sits on the query key, which is the same 200ms of typing
  // without a request — and the key is what lets a filter set returned to paint from cache
  // instead of re-reading.
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<FilterState>(EMPTY_FILTERS);
  useEffect(() => {
    const id = setTimeout(
      () => setApplied((prev) => (sameFilters(prev, filters) ? prev : filters)),
      200,
    );
    return () => clearTimeout(id);
  }, [filters]);

  // The owner's categories + tags: the rail's rows, the bar's two filter menus, the editor's
  // autocomplete sources and what the two manager dialogs edit. Re-read on save so a freshly
  // coined category/tag appears next time — and so a note moved into a new category puts that
  // category in the rail. Tags come back as id+label pairs because renaming or retiring one
  // addresses the ROW, and a label is not an address.
  //
  // Two lists rather than the one `Promise.all` this replaces: they are two routes, they cache
  // separately, and the pair fetches in parallel either way. Both report under this pane's own
  // step and rethrow, which is why each passes `reportErrors: false` — one failure reported
  // twice, under two contexts, is worse than one.
  //
  // Workspace-scoped like the notes themselves: the backend scopes the category/tag vocabulary
  // to the same owner it scopes the documents to, so the workspace is in the key.
  const loadCategories = useCallback(async () => {
    try {
      return await notesApi.categories({ workspace: workspaceSlug });
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "notebook-pane", step: "taxonomy" });
      throw err instanceof Error ? err : new Error("Failed to load categories.");
    }
  }, [workspaceSlug]);

  const loadTags = useCallback(async () => {
    try {
      return await notesApi.tagSet({ workspace: workspaceSlug });
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "notebook-pane", step: "taxonomy" });
      throw err;
    }
  }, [workspaceSlug]);

  const {
    items: categoryRows,
    error: categoriesError,
    reload: reloadCategories,
  } = useResourceList<NoteCategory>(
    `notes:${workspaceSlug ?? ""}:categories`,
    loadCategories,
    { reportErrors: false },
  );
  const { items: tagItems, reload: reloadTags } = useResourceList<NoteTag>(
    `notes:${workspaceSlug ?? ""}:tags`,
    loadTags,
    { reportErrors: false },
  );
  const tagRows = tagItems ?? [];

  // The workspace's ecosystems — the rail's read-only root level. Nothing in the notebook writes
  // an ecosystem, so nothing here ever invalidates it; the cache is what makes that "read once"
  // hold across a remount too, which is what an effect could never do.
  const loadEcosystems = useCallback(async () => {
    try {
      return workspaceSlug
        ? await ecosystemsApi.listForWorkspace(workspaceSlug)
        : await ecosystemsApi.list();
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "notebook-pane", step: "ecosystems" });
      throw err instanceof Error ? err : new Error("Failed to load ecosystems.");
    }
  }, [workspaceSlug]);

  // The empty slug is not a missing key: it is the CALLER's own scope, which is the other route
  // this fetcher can take.
  const { items: ecosystems, error: ecosystemsError } = useResourceList<Ecosystem>(
    `ecosystems:workspace:${workspaceSlug ?? ""}`,
    loadEcosystems,
    { reportErrors: false },
  );

  // ── The category tree + the chain the URL names ──────────────────────────
  const tree = useMemo(() => buildCategoryTree(categoryRows ?? []), [categoryRows]);
  // Keyed on the JOINED slugs: the parser hands us a fresh array every render, so the array
  // itself is never a stable dep.
  const slugKey = categorySlugs.join("/");
  // "Uncategorized" is a rail row, not a category, so it never resolves against the tree —
  // it is recognised by its reserved slug and short-circuits the whole chain.
  const uncategorized = categorySlugs[0] === UNCATEGORIZED_SLUG;
  const chain = useMemo(
    () => (uncategorized ? [] : resolveCategoryChain(tree, slugKey ? slugKey.split("/") : [])),
    [tree, slugKey, uncategorized],
  );
  // The RESOLVED chain is what every navigation is built from, not the raw URL slugs, so a
  // stale deep link normalises to what still exists the moment anything is clicked.
  const chainSlugs = uncategorized ? [UNCATEGORIZED_SLUG] : chain.map((node) => node.slug);
  const activeCategory: CategoryNode | null = chain[chain.length - 1] ?? null;
  const activeCategoryName = activeCategory?.name ?? "";
  const categoryOptions = useMemo(() => categoryNames(categoryRows ?? []), [categoryRows]);
  const tagOptions = useMemo(() => (tagItems ?? []).map((tag) => tag.label), [tagItems]);
  const previewLines = usePreviewLines();

  // What the rail's placement and the bar's category filter jointly ask for. Derived here rather
  // than inside the fetcher so the KEY can be built from the same answer: the plan is what
  // decides whether there is a request at all, and two different scopes must never share a key.
  const plan = useMemo(() => {
    const scope: CategoryScope = uncategorized
      ? { kind: "uncategorized" }
      : activeCategoryName
        ? { kind: "named", name: activeCategoryName }
        : { kind: "all" };
    return resolveListCategory(scope, applied.category);
  }, [uncategorized, activeCategoryName, applied.category]);

  const loadNotes = useCallback(async () => {
    // The rail and the filter name two different categories: nothing can match, so there is
    // nothing worth asking the backend. An empty list, not a skipped read — under a cache the
    // rows ARE the answer, and "no request" still has to produce one.
    if (plan.empty) return [];
    try {
      // `category` is an EXACT name match on the backend, which is what makes a category
      // hold only its own notes; the subcategories are their own levels.
      const rows = await notesApi.list(
        { q: applied.q, tag: applied.tag, category: plan.query },
        { workspace: workspaceSlug },
      );
      return plan.uncategorizedOnly ? rows.filter((row) => !row.category) : rows;
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "notebook-pane", step: "list" });
      // `errorText`'s wording, raised here so it survives the hook's own generic fallback.
      throw err instanceof Error ? err : new Error("Failed to load notes.");
    }
  }, [plan, applied.q, applied.tag, workspaceSlug]);

  // Keyed by the rail's SCOPE as well as the filters: walking into a category and back out is
  // two keys, each already read, so the second walk is a repaint rather than a round trip. The
  // scope has to be in the key spelled out — "uncategorized" is a scope no category name can
  // express, and an unfiltered list under a named category is not the whole notebook.
  const scopeKey = uncategorized ? UNCATEGORIZED_SLUG : activeCategoryName;
  const listPrefix = `notes:${workspaceSlug ?? ""}:list:`;
  const listKey = `${listPrefix}${scopeKey}|${applied.q}|${applied.category}|${applied.tag}`;
  const {
    items: notes,
    error: listError,
    reload: reloadNotes,
  } = useResourceList<NoteSummary>(listKey, loadNotes, { reportErrors: false });

  // Swallowing, and it has to: every caller re-reads AFTER its own write succeeded, and their
  // catch blocks say "Failed to save." / "Failed to delete.". A failed re-read is neither. The
  // list's own failure still reaches the screen, as `listError`.
  const refresh = useCallback(() => {
    // The SIBLING keys first. `reload` re-reads the one list on screen, but a save is exactly the
    // write that changes which list a note belongs to — its category and its tags are what the key
    // is built from — so every other scope/filter combination this workspace has cached is now
    // potentially wrong. Without this, walking back into the category a note just LEFT repaints it
    // still sitting there, from cache, with no read. Unmounted lists are only marked stale, so this
    // issues no request; the key on screen is excluded because `reloadNotes` already re-reads it
    // and invalidating it too would cancel that read and start a second one.
    revalidateResources((key) => key !== listKey && key.startsWith(listPrefix));
    return Promise.all([reloadNotes(), reloadCategories(), reloadTags()])
      .then(() => undefined)
      .catch(() => {});
  }, [reloadNotes, reloadCategories, reloadTags, listKey, listPrefix]);

  // ── Selection + draft ─────────────────────────────────────────────────────
  const selectedId = noteId ?? null;
  // Creating is a MODAL over the stack, never a blank leaf (HTD recipe `must-create-in-modal`).
  const [newNoteOpen, setNewNoteOpen] = useState(false);
  const [editingCategories, setEditingCategories] = useState(false);
  const [editingTags, setEditingTags] = useState(false);
  const [saving, setSaving] = useState(false);
  // A failed save or delete belongs to the NOTE it was raised on, so it is stored with that id
  // and read back only while that note is still open (see `formError` below). The loader this
  // pane used to own cleared the message on every selection change; deriving it does the same
  // for the URL path — Back, a deep link — which never runs through a click handler.
  const [raisedError, setRaisedError] = useState<{ id: string | null; text: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Re-entrancy latch for `onSave`. The `saving` STATE can't do this job: it is a render
  // value, so two activations inside a single commit (a double-click on Save before React
  // paints the disabled button) both read the pre-save `false` and both PUT. A ref flips
  // synchronously on the way in and clears in `finally`.
  const savingRef = useRef(false);

  // ── The open note ──────────────────────────────────────────────────────────
  // Cached per WORKSPACE, because `?workspace=` decides which principal's copy a read returns —
  // one key for a note id would let an org workspace paint the caller's own copy of it.
  const noteCacheKey = `notes:${workspaceSlug ?? ""}`;
  const loadNote = useCallback(
    (id: string) => notesApi.get(id, { workspace: workspaceSlug }),
    [workspaceSlug],
  );
  // Replaces the loader this pane hand-rolled: a `loadBody` + an out-of-order token + a "which
  // id is the form bound to" ref + a URL-sync effect that had to remember to skip itself. All
  // four existed to answer "is what's on screen the right note"; the cache answers it, and a
  // note opened a second time now paints from memory instead of from a GET.
  //
  // No `seedFrom`: a list row is a NoteSummary, whose `excerpt` is not the body, so there is no
  // partial Note to paint from. And no `absent`: this list is SCOPED by category and narrowed by
  // the bar's filters, so a note missing from it has merely been filtered away — announcing that
  // as a deletion would be a lie the user cannot argue with. The 404 is the honest signal.
  const {
    item: selectedNote,
    isSettled,
    isFetching: fetchingNote,
    error: noteError,
  } = useResourceItem<Note>(noteCacheKey, selectedId, loadNote);
  const prefetchNote = useResourceItemPrefetch(noteCacheKey, loadNote);
  const writeNote = useResourceItemWriter<Note>(noteCacheKey);

  // The server's copy, as the form would hold it.
  const baseline: NoteInput | null = selectedNote ? noteToInput(selectedNote) : null;
  // The user's in-progress edits, or null when the form is simply showing what the server has.
  //
  // It carries the id it belongs to, and the draft is DERIVED from it rather than copied into
  // state — which is what makes "instant paint, revalidate behind it" safe with no effect at
  // all. A revalidation landing under a user who is not typing is adopted immediately; one
  // landing under a user who IS typing loses to the override; and a selection change discards
  // it, because an override for another note is not this note's draft.
  const [override, setOverride] = useState<{ id: string; value: NoteInput } | null>(null);
  const draft = override && override.id === selectedId ? override.value : baseline;

  // The scoped read/write pair for `raisedError` above. Clearing is unscoped on purpose: there
  // is only ever one message, so "no error" needs no id to be about.
  const formError = raisedError && raisedError.id === selectedId ? raisedError.text : null;
  const setFormError = useCallback(
    (text: string | null) => setRaisedError(text === null ? null : { id: selectedId, text }),
    [selectedId],
  );

  const dirty = Boolean(draft && baseline && noteDiffers(draft, baseline));
  const validationError = draft ? noteValidate(draft) : null;
  // Dirty AND valid AND settled. `isSettled` is the successor to the old `!loadingNote` term and
  // carries one more rule with it: a save composed against a CACHED copy would PUT fields the
  // server has since changed. The busy term stays at the button, which already renders
  // `disabled={!canSave || saving}`.
  const canSave = Boolean(draft && baseline) && dirty && validationError === null && isSettled;
  // Delete waits on the same signal for the same reason: it is a write against a copy that may
  // already be out of date.
  const canDelete = selectedId !== null && isSettled && !saving && !deleting;

  function onChange(next: NoteInput): void {
    if (!selectedId) return;
    setOverride({ id: selectedId, value: next });
    if (formError) setFormError(null);
  }

  function onCancel(): void {
    onSelectNote(null, chainSlugs);
    setOverride(null);
    setFormError(null);
  }

  // Returns true once the draft is persisted (false on a validation/save failure) so the
  // merged stack's exit guard knows whether a gated navigation may proceed.
  async function onSave(): Promise<boolean> {
    if (!draft) return false;
    // Already in flight — swallow the duplicate. Reporting `false` is right for the exit
    // guard too: nothing has been persisted YET, so leaving now would still lose the edit.
    if (savingRef.current) return false;
    const problem = noteValidate(draft);
    if (problem) {
      setFormError(problem);
      return false;
    }
    const input = noteNormalize(draft);
    savingRef.current = true;
    setSaving(true);
    setFormError(null);
    try {
      // Create is a modal (see the CreateResourceDialog below); onSave only ever UPDATES.
      if (selectedId) {
        const updated = await notesApi.update(selectedId, toUpdateBody(input), {
          workspace: workspaceSlug,
        });
        await refresh();
        // The response IS the server's copy, so record it rather than invalidating — a re-read
        // would spend a request to arrive back at these exact bytes. Dropping the override then
        // hands the form straight back to `baseline`, which is now what we just saved.
        writeNote(updated.id, updated);
        setOverride(null);
      }
      return true;
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "notebook-pane", step: "save" });
      setFormError(errorText(err, "Failed to save."));
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function requestDelete(): void {
    if (canDelete) setPendingDelete(true);
  }

  function cancelDelete(): void {
    if (!deleting) setPendingDelete(false);
  }

  async function confirmDelete(): Promise<void> {
    if (!selectedId) return;
    setDeleting(true);
    try {
      await notesApi.remove(selectedId, { workspace: workspaceSlug });
      setPendingDelete(false);
      // Forget the body BEFORE leaving. Keeping it would paint a note we know is gone if the
      // user navigated back to its URL, and only the GET behind that paint would take it away.
      writeNote(selectedId, null);
      onSelectNote(null, chainSlugs);
      setOverride(null);
      await refresh();
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "notebook-pane", step: "delete" });
      setFormError(errorText(err, "Failed to delete."));
      setPendingDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  // ── The rail ───────────────────────────────────────────────────────────────
  // The workspace's ecosystems, purely as context: they say which vocabulary the categories
  // and tags below belong to. Every row is `disabled`, which is this list's whole contract —
  // a row that looked clickable and did nothing would read as broken, and there is nothing
  // for a click to do while the notebook is scoped by the WORKSPACE rather than by one
  // ecosystem within it.
  const ecosystemsLevel: TopicLevel = {
    id: "notebook-ecosystems",
    title: "Ecosystems",
    items: (ecosystems ?? []).map(
      (eco): TopicDetailItem => ({
        id: eco.id,
        label: eco.name,
        icon: <Boxes />,
        sublabel: eco.identifier || undefined,
        disabled: true,
      }),
    ),
    selectedId: null,
    itemNoun: "ecosystem",
    onSelect: () => {},
    onClear: () => {},
    emptyLabel:
      ecosystemsError ?? (ecosystems === null ? "Loading…" : "No ecosystems in this workspace."),
  };

  // One level per category DEPTH, then the notes. The loop publishes the root list, then a
  // child list for each selected category that HAS children — so the rail is exactly as deep
  // as the tree the user has walked into, and a leaf category doesn't publish an empty list.
  const categoryLevels: TopicLevel[] = [];
  {
    let siblings = tree;
    let title = "Categories";
    for (let depth = 0; ; depth++) {
      const picked: CategoryNode | undefined = chain[depth];
      const ancestors = chainSlugs.slice(0, depth);
      // The root list leads with the two rows that are not categories. Both name a SCOPE the
      // list can be in but no category expresses: the whole notebook, and the notes filed
      // nowhere. Their ids come from the reserved `-*` space (see parse-path) so neither can
      // ever collide with a real category's slug.
      const leadRows: TopicDetailItem[] =
        depth === 0
          ? [
              { id: ALL_CATEGORIES_ID, label: "All", icon: <LayoutList /> },
              { id: UNCATEGORIZED_SLUG, label: "Uncategorized", icon: <Inbox />, dividerAfter: true },
            ]
          : [];
      categoryLevels.push({
        id: `notebook-categories-${depth}`,
        title,
        items: [
          ...leadRows,
          ...siblings.map(
            (node): TopicDetailItem => ({
              id: node.slug,
              label: node.name,
              icon: <Folder />,
              sublabel:
                node.children.length === 1
                  ? "1 subcategory"
                  : node.children.length > 1
                    ? `${node.children.length} subcategories`
                    : undefined,
            }),
          ),
        ],
        selectedId:
          picked?.slug ??
          (depth > 0 ? null : uncategorized ? UNCATEGORIZED_SLUG : ALL_CATEGORIES_ID),
        // Every category discloses more lists (its notes, and any subcategories), so the
        // detail pane holds through an intermediate pick.
        leadsTo: "list",
        itemNoun: "category",
        onSelect: (slug) => {
          if (depth === 0 && slug === ALL_CATEGORIES_ID) return onSelectCategory([]);
          if (depth === 0 && slug === UNCATEGORIZED_SLUG) {
            return onSelectCategory([UNCATEGORIZED_SLUG]);
          }
          onSelectCategory([...ancestors, slug]);
        },
        onClear: () => onSelectCategory(ancestors),
        // The error first, for the same reason the ecosystems level puts it first: a failed read
        // leaves the rows null, and "Loading…" forever is a lie the user can't act on.
        emptyLabel:
          categoriesError ??
          (categoryRows === null
            ? "Loading…"
            : depth === 0
              ? "No categories yet."
              : "No subcategories."),
      });
      if (!picked || picked.children.length === 0) break;
      siblings = picked.children;
      title = picked.name;
    }
  }

  const rows = notes ?? [];
  const filtering = Boolean(filters.q || filters.category || filters.tag);
  const notesLevel: TopicLevel = {
    id: "notebook-notes",
    title: "Notes",
    items: rows.map(
      (note): TopicDetailItem => ({
        id: note.id,
        label: note.title || "Untitled",
        icon: <NotebookPen />,
        // Inside a category every row shares it, so the one sublabel line spends itself on
        // tags; in the whole-notebook list the category is the row's most useful fact.
        sublabel:
          [activeCategory ? null : note.category, ...note.tags].filter(Boolean).join(" · ") ||
          undefined,
        preview: previewLines > 0 ? note.excerpt || undefined : undefined,
        previewLines,
        // The open note can't be saved, and the row is where the user is looking when they
        // wonder why Save is grey. The reason itself is on the field, in the editor.
        blocked: note.id === selectedId && validationError !== null,
      }),
    ),
    selectedId,
    itemNoun: "note",
    onSelect: (id) => onSelectNote(id, chainSlugs),
    // Hovering (or tabbing to) a row for a moment warms its body, so the click that follows has
    // nothing left to wait for.
    onPrefetch: prefetchNote,
    // The spinner in front of "Notes" — the one signal that a read is happening, now that the
    // editor paints the cached copy instead of blanking to "Loading…".
    busy: fetchingNote,
    onClear: onCancel,
    emptyLabel:
      notes === null
        ? "Loading…"
        : filtering
          ? "No notes match these filters."
          : uncategorized
            ? "Every note is filed in a category."
            : activeCategory
              ? "No notes in this category yet."
              : "No notes yet.",
    titleActions: <NoteListOptions />,
  };

  // Registered only while DIRTY so the host's guard count is a render-value dirty signal.
  useRailExitGuard(dirty ? { isDirty: () => dirty } : null);

  // The host-injected per-record affordance (the hub's api-explorer button); null on a
  // standalone feature site → the trailing slot renders nothing.
  const renderRecordAffordance = useRecordAffordance();

  const editing = selectedId !== null;
  // Deliberately NOT gated on `dirty`. Save is disabled the moment the draft is invalid, and
  // a note written before the body became required opens invalid and untouched — under a
  // dirty gate the button was grey with nothing on screen saying why. The reason belongs to
  // the field, not to the edit.
  const validationHint = draft ? validationError : null;

  // Rename a category from the crumb the note is filed under. Passed to both editors so the
  // tree is fixable from wherever the mistake is noticed, not only from the manager dialog.
  const renameCategory = useCallback(
    async (node: CategoryTreeNode, nextName: string) => {
      await taxonomyApi.renameCategory(node.id, nextName);
      // Categories only — a rename can't touch the tag vocabulary. Swallowing for the usual
      // reason: the rename already succeeded, so a failed re-read must not surface as one that
      // didn't.
      await reloadCategories().catch(() => {});
    },
    [reloadCategories],
  );

  const noteFieldProps = {
    categoryOptions,
    categoryNodes: categoryRows ?? [],
    onRenameCategory: renameCategory,
    tagOptions,
  };

  // The frontier leaf: a portaled Save/Cancel/Delete bar over the editor (or a placeholder).
  // The lists live in the published rail above, so this renders ONLY the editor half.
  const actions: MasterDetailActions = {
    onCreate: () => setNewNoteOpen(true),
    createLabel: "New note",
    onCancel,
    canCancel: editing,
    onSave: () => void onSave(),
    canSave,
    saving,
    onDelete: requestDelete,
    canDelete,
    // This pane owns its own (note-specific) delete confirm modal below, so the bar's
    // generic confirm stays off — its Delete button just opens ours.
    deletePrompt: null,
  };

  return (
    <>
      {/* Published into the home bar, the strip under the workspace bar. It sits outside the rail
          because it acts on the LIST as a whole, not on the level the rail happens to be showing. */}
      <HomeBarPortal>
        <NoteButtonBar
          filters={filters}
          onChange={setFilters}
          categories={categoryOptions}
          tags={tagOptions}
          onEditCategories={() => setEditingCategories(true)}
          onEditTags={() => setEditingTags(true)}
          onCreateNote={() => setNewNoteOpen(true)}
        />
      </HomeBarPortal>

      {/* Every level in one publication: the ecosystems, the category chain, then the notes.
          StackLevels (not useStackLevel) because the count VARIES with the depth walked into,
          and it advances the depth for the leaf below by exactly that many. */}
      <StackLevels levels={[ecosystemsLevel, ...categoryLevels, notesLevel]}>
        <MasterDetailLeaf
          form={{ actions, editing, draft }}
          trailing={renderRecordAffordance?.({
            path: "/content/markdown/{id}",
            pathValues: { id: selectedId },
            title: "Note API",
          })}
          error={listError ?? formError ?? noteError}
          emptyTitle={
            // Reached only with nothing cached for this id — otherwise `draft` is already the
            // cached note and the editor below renders instead.
            fetchingNote || notes === null
              ? "Loading…"
              : "Select a note to edit, or write a new one."
          }
          renderDetail={(d) => (
            <div className="flex flex-col gap-4">
              {/* No "Loading…" branch: whatever is cached is on screen from the first frame, and
                  the read settles behind it. `disabled` is what makes that safe — see
                  `isSettled`. */}
              <NoteDetail
                {...noteFieldProps}
                draft={d}
                onChange={onChange}
                error={validationHint}
                disabled={!isSettled}
              />
            </div>
          )}
        />
      </StackLevels>

      {/* Create is the SAME three fields the editor shows, in the same order — one component,
          so the two can't drift. The body is required here: a note whose title is its first
          line has no identity until something is written, and creating an empty one used to
          mint a note that could never be saved again. The category is seeded from the rail's
          placement and stays editable, so the modal files it where it was opened without
          being unable to say otherwise. */}
      {newNoteOpen && (
        <CreateResourceDialog<NoteInput, Note>
          ariaLabel="New note"
          heading={activeCategory ? `New note in ${activeCategory.name}` : "New note"}
          blank={() => ({ ...noteBlank(), category: activeCategoryName })}
          validate={noteValidate}
          create={(d) =>
            notesApi.create(toCreateBody(noteNormalize(d)), { workspace: workspaceSlug })
          }
          onClose={() => setNewNoteOpen(false)}
          onCreated={(created) => {
            setNewNoteOpen(false);
            void refresh();
            // Record the created note BEFORE opening it, so the editor it opens into paints from
            // the cache with no read at all — the create response already is the server's copy.
            // (This is what the old `loadedIdRef` dance was for.)
            writeNote(created.id, created);
            onSelectNote(created.id, chainSlugs);
            setOverride(null);
            setFormError(null);
          }}
          renderForm={(d, onDraftChange, error) => (
            <NoteFields {...noteFieldProps} draft={d} onChange={onDraftChange} error={error} />
          )}
        />
      )}

      {editingCategories && (
        <CategoryManagerDialog
          rows={categoryRows ?? []}
          workspaceSlug={workspaceSlug}
          onClose={() => setEditingCategories(false)}
          onChanged={refresh}
        />
      )}

      {editingTags && (
        <TagManagerDialog
          tags={tagRows}
          onClose={() => setEditingTags(false)}
          onChanged={refresh}
        />
      )}

      <AlertModal
        open={pendingDelete}
        destructive
        title="Delete note?"
        description="This soft-deletes the note and removes it from your notes bucket."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={cancelDelete}
      />
    </>
  );
}
