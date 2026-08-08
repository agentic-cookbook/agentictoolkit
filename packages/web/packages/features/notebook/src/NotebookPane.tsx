"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Folder, NotebookPen } from "lucide-react";

import { reportUnexpectedAuthError } from "@agentic-toolkit/auth";
import { AlertModal } from "@agentic-toolkit/ui/components/alert-modal";
import type { TopicDetailItem, TopicLevel } from "@agentic-toolkit/ui/blocks";
import { Field } from "@agentic-toolkit/ui/blocks";
import { Input } from "@agentic-toolkit/ui/components/input";
import {
  StackLevels,
  useRailExitGuard,
  MasterDetailLeaf,
  useRecordAffordance,
  CreateResourceDialog,
  type MasterDetailActions,
} from "@agentic-toolkit/resource";
import {
  notesApi,
  type Note,
  type NoteCategory,
  type NoteSummary,
} from "@agentic-toolkit/data/notes";
import {
  buildCategoryTree,
  categoryNames,
  resolveCategoryChain,
  slugFor,
  type CategoryNode,
} from "./category-tree";
import {
  noteDiffers,
  noteNormalize,
  noteToInput,
  noteValidate,
  tagsOf,
  toCreateBody,
  toUpdateBody,
  type NoteInput,
} from "./note-model";
import { NoteDetail } from "./NoteDetail";
import { NoteFilters, type FilterState } from "./NoteFilters";

const EMPTY_FILTERS: FilterState = { q: "", tag: "" };

/** The create modal's PLACEMENT draft (HTD recipe `must-create-in-modal` +
 *  `must-scope-create-modal-to-placement`). Only the title: the note's category is the
 *  RAIL's current selection, which is the placement — asking for it again would let the
 *  modal file a note somewhere other than where the user opened it. It stays editable
 *  afterwards in the note's own Category field. */
interface NotePlacement {
  title: string;
}

/** The new-category modal's placement: which list its `+` was pressed in. */
interface CategoryPlacement {
  /** Rail depth of that list — where to navigate once the category exists. */
  depth: number;
  /** The category the new one goes UNDER (null at the root level). */
  parentId: string | null;
  parentName: string | null;
}

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
 *     document level; this publishes one level per category depth, then the notes. Selecting
 *     a category narrows the notes to the ones filed DIRECTLY in it — its subcategories are
 *     the next rail level, exactly as a folder holds its own files and its subfolders hold
 *     theirs. With nothing selected the list is the whole notebook, which is the useful
 *     landing: you open the notebook and see your notes, not an empty pane demanding a
 *     folder.
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
  // The unfiltered universe, only for the filter dropdown options — so narrowing the list
  // (which refetches `notes`) never empties its own tag menu.
  const [universe, setUniverse] = useState<NoteSummary[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [categoryRows, setCategoryRows] = useState<NoteCategory[] | null>(null);
  const [accountTags, setAccountTags] = useState<string[]>([]);

  // ── The category tree + the chain the URL names ──────────────────────────
  const tree = useMemo(() => buildCategoryTree(categoryRows ?? []), [categoryRows]);
  // Keyed on the JOINED slugs: the parser hands us a fresh array every render, so the array
  // itself is never a stable dep.
  const slugKey = categorySlugs.join("/");
  const chain = useMemo(
    () => resolveCategoryChain(tree, slugKey ? slugKey.split("/") : []),
    [tree, slugKey],
  );
  // The RESOLVED chain is what every navigation is built from, not the raw URL slugs, so a
  // stale deep link normalises to what still exists the moment anything is clicked.
  const chainSlugs = chain.map((node) => node.slug);
  const activeCategory: CategoryNode | null = chain[chain.length - 1] ?? null;
  const activeCategoryName = activeCategory?.name ?? "";
  const categoryOptions = useMemo(() => categoryNames(categoryRows ?? []), [categoryRows]);

  const loadList = useCallback(
    async (f: FilterState) => {
      try {
        // `category` is an EXACT name match on the backend, which is what makes a category
        // hold only its own notes; the subcategories are their own levels.
        setNotes(
          await notesApi.list(
            { q: f.q, tag: f.tag, category: activeCategoryName },
            { workspace: workspaceSlug },
          ),
        );
        setListError(null);
      } catch (err) {
        reportUnexpectedAuthError(err, { feature: "notebook-pane", step: "list" });
        setListError(errorText(err, "Failed to load notes."));
      }
    },
    [workspaceSlug, activeCategoryName],
  );

  const loadUniverse = useCallback(async () => {
    try {
      setUniverse(await notesApi.list({}, { workspace: workspaceSlug }));
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "notebook-pane", step: "universe" });
    }
  }, [workspaceSlug]);

  // The owner's categories + tags: the rail's rows and the editor's autocomplete sources.
  // Refetched on save so a freshly coined category/tag appears next time — and so a note
  // moved into a new category puts that category in the rail.
  const loadTaxonomy = useCallback(async () => {
    try {
      // Workspace-scoped like the notes themselves: the backend scopes the category/tag
      // vocabulary to the same owner it scopes the documents to.
      const [categories, tags] = await Promise.all([
        notesApi.categories({ workspace: workspaceSlug }),
        notesApi.tags({ workspace: workspaceSlug }),
      ]);
      setCategoryRows(categories);
      setAccountTags(tags);
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "notebook-pane", step: "taxonomy" });
    }
  }, [workspaceSlug]);

  useEffect(() => {
    void loadTaxonomy();
  }, [loadTaxonomy]);

  // Refetch the list when the filters or the selected category change (debounced so typing
  // search doesn't fire a request per keystroke).
  useEffect(() => {
    const id = setTimeout(() => void loadList(filters), 200);
    return () => clearTimeout(id);
  }, [filters, loadList]);

  useEffect(() => {
    void loadUniverse();
  }, [loadUniverse]);

  const refresh = useCallback(
    () => Promise.all([loadList(filters), loadUniverse(), loadTaxonomy()]).then(() => undefined),
    [filters, loadList, loadUniverse, loadTaxonomy],
  );

  // ── Selection + draft ─────────────────────────────────────────────────────
  const selectedId = noteId ?? null;
  // Creating is a MODAL over the stack, never a blank leaf (HTD recipe `must-create-in-modal`).
  const [newNoteOpen, setNewNoteOpen] = useState(false);
  const [newCategory, setNewCategory] = useState<CategoryPlacement | null>(null);
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
  // One level per category DEPTH, then the notes. The loop publishes the root list, then a
  // child list for each selected category that HAS children — so the rail is exactly as deep
  // as the tree the user has walked into, and a leaf category doesn't publish an empty list.
  const categoryLevels: TopicLevel[] = [];
  {
    let siblings = tree;
    let title = "Categories";
    let parent: CategoryNode | null = null;
    for (let depth = 0; ; depth++) {
      const picked: CategoryNode | undefined = chain[depth];
      const ancestors = chainSlugs.slice(0, depth);
      const parentId = parent?.id ?? null;
      const parentName = parent?.name ?? null;
      categoryLevels.push({
        id: `notebook-categories-${depth}`,
        title,
        items: siblings.map(
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
        selectedId: picked?.slug ?? null,
        // Every category discloses more lists (its notes, and any subcategories), so the
        // detail pane holds through an intermediate pick.
        leadsTo: "list",
        itemNoun: "category",
        onSelect: (slug) => onSelectCategory([...ancestors, slug]),
        onClear: () => onSelectCategory(ancestors),
        onNew: () => setNewCategory({ depth, parentId, parentName }),
        newLabel: parentName ? `New category in ${parentName}` : "New category",
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
      parent = picked;
    }
  }

  const rows = notes ?? [];
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
      }),
    ),
    selectedId,
    itemNoun: "note",
    onSelect: (id) => onSelectNote(id, chainSlugs),
    onClear: onCancel,
    onNew: () => setNewNoteOpen(true),
    newLabel: activeCategory ? `New note in ${activeCategory.name}` : "New note",
    emptyLabel:
      notes === null
        ? "Loading…"
        : activeCategory
          ? "No notes in this category yet."
          : "No notes yet.",
    railSlot: <NoteFilters filters={filters} onChange={setFilters} tags={tagsOf(universe)} />,
  };

  // Registered only while DIRTY so the host's guard count is a render-value dirty signal.
  useRailExitGuard(dirty ? { isDirty: () => dirty } : null);

  // The host-injected per-record affordance (the hub's api-explorer button); null on a
  // standalone feature site → the trailing slot renders nothing.
  const renderRecordAffordance = useRecordAffordance();

  const editing = selectedId !== null;
  const validationHint = draft && dirty ? validationError : null;

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
      {/* Every level in one publication: the category chain, then the notes. StackLevels (not
          useStackLevel) because the count VARIES with the depth walked into, and it advances
          the depth for the leaf below by exactly that many. */}
      <StackLevels levels={[...categoryLevels, notesLevel]}>
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
                  draft={d}
                  onChange={onChange}
                  categoryOptions={categoryOptions}
                  tagOptions={accountTags}
                  error={validationHint}
                />
              )}
            </div>
          )}
        />
      </StackLevels>

      {/* Create is a scoped modal: the title only. The note is filed in the category the rail
          is currently on, and its body is written in the editor that opens once it exists —
          the backend accepts an empty body on create. */}
      {newNoteOpen && (
        <CreateResourceDialog<NotePlacement, Note>
          ariaLabel="New note"
          heading={activeCategory ? `New note in ${activeCategory.name}` : "New note"}
          blank={() => ({ title: "" })}
          validate={(d) => (!d.title.trim() ? "A title is required." : null)}
          create={(d) =>
            notesApi.create(
              toCreateBody(
                noteNormalize({
                  title: d.title,
                  content: "",
                  category: activeCategoryName,
                  tags: [],
                }),
              ),
              { workspace: workspaceSlug },
            )
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
            <>
              <Field label="Title">
                <Input
                  /* eslint-disable-next-line jsx-a11y/no-autofocus -- focus the first field on open */
                  autoFocus
                  value={d.title}
                  placeholder="Untitled note"
                  onChange={(e) => onDraftChange({ ...d, title: e.target.value })}
                />
              </Field>
              {error && <p className="text-sm text-apt-red">{error}</p>}
            </>
          )}
        />
      )}

      {newCategory && (
        <CreateResourceDialog<{ name: string }, NoteCategory>
          ariaLabel="New category"
          heading={
            newCategory.parentName ? `New category in ${newCategory.parentName}` : "New category"
          }
          blank={() => ({ name: "" })}
          validate={(d) =>
            !d.name.trim()
              ? "A name is required."
              : d.name.length > 200
                ? "Name must be 200 characters or fewer."
                : null
          }
          create={(d) =>
            notesApi.createCategory(
              { name: d.name.trim(), parentId: newCategory.parentId },
              { workspace: workspaceSlug },
            )
          }
          onClose={() => setNewCategory(null)}
          onCreated={(created) => {
            const { depth } = newCategory;
            setNewCategory(null);
            // Navigate straight in. The refetch is deliberately NOT awaited: the chain
            // resolves against whatever tree is loaded, so the new slug is simply unresolved
            // for one frame (the rail sits on the parent) and snaps into place when the rows
            // land — the URL is already right either way.
            void refresh();
            onSelectCategory([
              ...chainSlugs.slice(0, depth),
              slugFor(created.name, created.id),
            ]);
          }}
          renderForm={(d, onDraftChange, error) => (
            <>
              <Field
                label="Name"
                hint="A category name is unique across your notebook — it names one place in it."
              >
                <Input
                  /* eslint-disable-next-line jsx-a11y/no-autofocus -- focus the first field on open */
                  autoFocus
                  value={d.name}
                  placeholder="e.g. Meetings"
                  onChange={(e) => onDraftChange({ ...d, name: e.target.value })}
                />
              </Field>
              {error && <p className="text-sm text-apt-red">{error}</p>}
            </>
          )}
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
