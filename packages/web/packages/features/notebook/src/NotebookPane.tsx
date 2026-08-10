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
  FeatureBarPortal,
  type MasterDetailActions,
} from "@agentic-toolkit/resource";
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
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [notes, setNotes] = useState<NoteSummary[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [categoryRows, setCategoryRows] = useState<NoteCategory[] | null>(null);
  const [tagRows, setTagRows] = useState<NoteTag[]>([]);
  const [ecosystems, setEcosystems] = useState<Ecosystem[] | null>(null);
  const [ecosystemsError, setEcosystemsError] = useState<string | null>(null);

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
  const tagOptions = useMemo(() => tagRows.map((tag) => tag.label), [tagRows]);
  const previewLines = usePreviewLines();

  const loadList = useCallback(
    async (f: FilterState) => {
      const scope: CategoryScope = uncategorized
        ? { kind: "uncategorized" }
        : activeCategoryName
          ? { kind: "named", name: activeCategoryName }
          : { kind: "all" };
      const plan = resolveListCategory(scope, f.category);
      // The rail and the filter name two different categories: nothing can match, so there is
      // nothing worth asking the backend.
      if (plan.empty) {
        setNotes([]);
        setListError(null);
        return;
      }
      try {
        // `category` is an EXACT name match on the backend, which is what makes a category
        // hold only its own notes; the subcategories are their own levels.
        const rows = await notesApi.list(
          { q: f.q, tag: f.tag, category: plan.query },
          { workspace: workspaceSlug },
        );
        setNotes(plan.uncategorizedOnly ? rows.filter((row) => !row.category) : rows);
        setListError(null);
      } catch (err) {
        reportUnexpectedAuthError(err, { feature: "notebook-pane", step: "list" });
        setListError(errorText(err, "Failed to load notes."));
      }
    },
    [workspaceSlug, activeCategoryName, uncategorized],
  );

  // The owner's categories + tags: the rail's rows, the bar's two filter menus, the editor's
  // autocomplete sources and what the two manager dialogs edit. Refetched on save so a freshly
  // coined category/tag appears next time — and so a note moved into a new category puts that
  // category in the rail. Tags come back as id+label pairs because renaming or retiring one
  // addresses the ROW, and a label is not an address.
  const loadTaxonomy = useCallback(async () => {
    try {
      // Workspace-scoped like the notes themselves: the backend scopes the category/tag
      // vocabulary to the same owner it scopes the documents to.
      const [categories, tags] = await Promise.all([
        notesApi.categories({ workspace: workspaceSlug }),
        notesApi.tagSet({ workspace: workspaceSlug }),
      ]);
      setCategoryRows(categories);
      setTagRows(tags);
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "notebook-pane", step: "taxonomy" });
    }
  }, [workspaceSlug]);

  // The workspace's ecosystems — the rail's read-only root level. Loaded once: nothing in the
  // notebook writes an ecosystem, so nothing here can invalidate it.
  const loadEcosystems = useCallback(async () => {
    try {
      setEcosystems(
        workspaceSlug
          ? await ecosystemsApi.listForWorkspace(workspaceSlug)
          : await ecosystemsApi.list(),
      );
      setEcosystemsError(null);
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "notebook-pane", step: "ecosystems" });
      // Say so rather than leaving the level reading "Loading…" forever.
      setEcosystems([]);
      setEcosystemsError(errorText(err, "Failed to load ecosystems."));
    }
  }, [workspaceSlug]);

  useEffect(() => {
    void loadTaxonomy();
  }, [loadTaxonomy]);

  useEffect(() => {
    void loadEcosystems();
  }, [loadEcosystems]);

  // Refetch the list when the filters or the selected category change (debounced so typing
  // search doesn't fire a request per keystroke).
  useEffect(() => {
    const id = setTimeout(() => void loadList(filters), 200);
    return () => clearTimeout(id);
  }, [filters, loadList]);

  const refresh = useCallback(
    () => Promise.all([loadList(filters), loadTaxonomy()]).then(() => undefined),
    [filters, loadList, loadTaxonomy],
  );

  // ── Selection + draft ─────────────────────────────────────────────────────
  const selectedId = noteId ?? null;
  // Creating is a MODAL over the stack, never a blank leaf (HTD recipe `must-create-in-modal`).
  const [newNoteOpen, setNewNoteOpen] = useState(false);
  const [editingCategories, setEditingCategories] = useState(false);
  const [editingTags, setEditingTags] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [draft, setDraft] = useState<NoteInput | null>(null);
  const [loadingNote, setLoadingNote] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Guards against an out-of-order body fetch clobbering a newer selection.
  const selectToken = useRef(0);
  // The note id currently hydrated into the form. The URL-sync effect skips re-fetching when
  // it already matches — e.g. right after create seeds the returned note — so a just-opened
  // note doesn't flash to "Loading…" + issue a redundant GET.
  const loadedIdRef = useRef<string | null>(null);
  // Re-entrancy latch for `onSave`. The `saving` STATE can't do this job: it is a render
  // value, so two activations inside a single commit (a double-click on Save before React
  // paints the disabled button) both read the pre-save `false` and both PUT. A ref flips
  // synchronously on the way in and clears in `finally`.
  const savingRef = useRef(false);

  const baseline: NoteInput | null = selectedNote ? noteToInput(selectedNote) : null;
  const dirty = Boolean(draft && baseline && noteDiffers(draft, baseline));
  const validationError = draft ? noteValidate(draft) : null;
  // Dirty AND valid — `!loadingNote` is a DATA-AVAILABILITY term (there is no baseline to
  // diverge from until the body has landed), not a busy term. The busy term is applied at
  // the button, which already renders `disabled={!canSave || saving}`.
  const canSave = Boolean(draft && baseline) && dirty && validationError === null && !loadingNote;
  const canDelete = selectedId !== null && !saving && !deleting;

  // Load a note's body into the form (or clear it when id is null). Token-guarded so an
  // out-of-order fetch can't clobber a newer selection.
  const loadBody = useCallback(
    async (id: string | null) => {
      const token = ++selectToken.current;
      loadedIdRef.current = id; // the form is now bound to `id` (see the URL-sync effect)
      setSelectedNote(null);
      setDraft(null);
      setFormError(null);
      if (id == null) {
        setLoadingNote(false);
        return;
      }
      setLoadingNote(true);
      try {
        const full = await notesApi.get(id, { workspace: workspaceSlug });
        if (selectToken.current !== token) return; // a newer selection won
        setSelectedNote(full);
        setDraft(noteToInput(full));
      } catch (err) {
        if (selectToken.current !== token) return;
        reportUnexpectedAuthError(err, { feature: "notebook-pane", step: "open" });
        setFormError(errorText(err, "Failed to open the note."));
      } finally {
        if (selectToken.current === token) setLoadingNote(false);
      }
    },
    [workspaceSlug],
  );

  // Load (or clear) the note body when the open id in the URL changes — a deep-link landing,
  // reload, browser back/forward, or an in-app navigation.
  useEffect(() => {
    // Skip when the form is already bound to this id (e.g. create just seeded the returned
    // note, or loadBody already ran for it) — avoids a redundant GET + a "Loading…" flash.
    if (loadedIdRef.current === selectedId) return;
    void loadBody(selectedId);
  }, [selectedId, loadBody]);

  function onChange(next: NoteInput): void {
    setDraft(next);
    if (formError) setFormError(null);
  }

  function onCancel(): void {
    selectToken.current++;
    onSelectNote(null, chainSlugs);
    setSelectedNote(null);
    setDraft(null);
    setFormError(null);
    setLoadingNote(false);
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
        setSelectedNote(updated);
        setDraft(noteToInput(updated));
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
      onSelectNote(null, chainSlugs);
      setSelectedNote(null);
      setDraft(null);
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
        emptyLabel:
          categoryRows === null
            ? "Loading…"
            : depth === 0
              ? "No categories yet."
              : "No subcategories.",
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
      await loadTaxonomy();
    },
    [loadTaxonomy],
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
      {/* Published into the host's feature-bar slot, under the workspace bar. It sits outside
          the rail because it acts on the LIST as a whole, not on the level the rail happens
          to be showing. */}
      <FeatureBarPortal>
        <NoteButtonBar
          filters={filters}
          onChange={setFilters}
          categories={categoryOptions}
          tags={tagOptions}
          onEditCategories={() => setEditingCategories(true)}
          onEditTags={() => setEditingTags(true)}
          onCreateNote={() => setNewNoteOpen(true)}
        />
      </FeatureBarPortal>

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
          error={listError ?? formError}
          emptyTitle={
            loadingNote || notes === null ? "Loading…" : "Select a note to edit, or write a new one."
          }
          renderDetail={(d) => (
            <div className="flex flex-col gap-4">
              {loadingNote ? (
                <p className="text-sm text-apt-text-muted">Loading…</p>
              ) : (
                <NoteDetail
                  {...noteFieldProps}
                  draft={d}
                  onChange={onChange}
                  error={validationHint}
                />
              )}
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
            // Open it: seed note/draft + mark it loaded so the URL-sync effect skips the fetch.
            loadedIdRef.current = created.id;
            onSelectNote(created.id, chainSlugs);
            setSelectedNote(created);
            setDraft(noteToInput(created));
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
