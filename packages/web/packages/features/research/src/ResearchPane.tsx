"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Globe } from "lucide-react";

import { reportUnexpectedAuthError, useAuth } from "@agentic-toolkit/auth";
import { AlertModal } from "@agentic-toolkit/ui/components/alert-modal";
import type { TopicDetailItem, TopicLevel } from "@agentic-toolkit/ui/blocks";
import { Field } from "@agentic-toolkit/ui/blocks";
import { Input } from "@agentic-toolkit/ui/components/input";
import { useDualModeSelection } from "@agentic-toolkit/ui/hooks/useDualModeSelection";
import { slugify } from "@agentic-toolkit/ui/lib/slug";
import {
  useStackLevel,
  useRailExitGuard as useWorkspaceExitGuard,
  MasterDetailLeaf,
  useRecordAffordance,
  CreateResourceDialog,
  type MasterDetailActions,
} from "@agentic-toolkit/resource";
import {
  markdownApi,
  type ResearchDocument,
  type ResearchSummary,
} from "@agentic-toolkit/data/markdown";
import {
  categoriesOf,
  researchDiffers,
  researchNormalize,
  researchToInput,
  researchValidate,
  tagsOf,
  toCreateBody,
  toUpdateBody,
  type ResearchInput,
} from "./research-model";
import { ResearchDetail } from "./ResearchDetail";
import { ResearchFilters, type FilterState } from "./ResearchFilters";
import { PublishSection } from "./PublishSection";

const EMPTY_FILTERS: FilterState = { q: "", category: "", tag: "" };

/** The create modal's PLACEMENT draft (HTD recipe `must-create-in-modal` +
 *  `must-scope-create-modal-to-placement`): only what NAMES/classifies the new document.
 *  The body is written in the full editor that opens once the created doc is selected — the
 *  backend accepts an empty body on create (content is optional), so create-then-write works. */
interface ResearchPlacement {
  title: string;
  category: string;
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/**
 * The /research workspace: a master/detail surface over the signed-in user's
 * markdown research documents. This pane owns the data (list/search + the full
 * document loaded on selection) and the form state (selection, draft, dirty/
 * validity, save/delete); the fields-only editor, the publish concern, and the
 * filters are their own components, and the two-pane layout + toolbar are the
 * shared EditorSection block.
 *
 * DUAL SELECTION MODE (mirrors PersonasSection): pass `urlSelection` and the open document lives in
 * the URL + is deep-linkable — the `/<slug>/research` route wires this via {@link ResearchFeature}.
 * Omit it — as the embedded ecosystem topic rail does (`renderFeaturePanel("research")`) — and
 * selection is internal state, so opening a document happens IN PLACE without navigating away.
 */
export function ResearchPane({
  urlSelection,
  userSlug: userSlugProp,
  workspaceSlug,
}: {
  urlSelection?: {
    /** The open document's id, from the URL path segment (`/<slug>/research/<docId>`). */
    docId?: string;
    /** Route to a document (null clears back to the list). */
    onSelectDoc: (id: string | null) => void;
  };
  /** Host OVERRIDE for the public-URL slug to publish under. Normally unnecessary: the
   *  signed-in user's backend-persisted profile slug (typed on the auth user shape, returned
   *  by GET /auth/me) is used directly below; a host only passes this to publish under a
   *  different namespace. */
  userSlug?: string;
  /** Pins every op to the WORKSPACE'S owning principal (backend `?workspace=`), so an org
   *  workspace shows the ORG'S documents and creates org-owned ones. Omitted: the caller's. */
  workspaceSlug?: string;
} = {}) {
  const { user } = useAuth();
  // The slug is backend-persisted (Settings → Profile writes it via PATCH /auth/me) and rides
  // the auth user, so it is authoritative here; the prop is an explicit host override, and a
  // slugified display name is the last-resort fallback for users who predate profile slugs.
  const userSlug = userSlugProp ?? user?.slug ?? slugify(user?.name ?? "");

  // ── Data ────────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [docs, setDocs] = useState<ResearchSummary[] | null>(null);
  // The unfiltered universe, only for the filter dropdown options — so narrowing
  // the list (which refetches `docs`) never empties its own category/tag menus.
  const [universe, setUniverse] = useState<ResearchSummary[]>([]);
  const [listError, setListError] = useState<string | null>(null);

  const loadList = useCallback(
    async (f: FilterState) => {
      try {
        setDocs(await markdownApi.list(f, { workspace: workspaceSlug }));
        setListError(null);
      } catch (err) {
        reportUnexpectedAuthError(err, { feature: "research-pane", step: "list" });
        setListError(errorText(err, "Failed to load documents."));
      }
    },
    [workspaceSlug],
  );

  const loadUniverse = useCallback(async () => {
    try {
      setUniverse(await markdownApi.list({}, { workspace: workspaceSlug }));
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "research-pane", step: "universe" });
    }
  }, [workspaceSlug]);

  // The account's existing categories + tags — the editor's autocomplete/browse source
  // (distinct from the filter rail, which lists only what's present on the loaded docs).
  // Refetched on save so a freshly-coined category/tag appears as a suggestion next time.
  const [accountCategories, setAccountCategories] = useState<string[]>([]);
  const [accountTags, setAccountTags] = useState<string[]>([]);
  const loadTaxonomy = useCallback(async () => {
    try {
      const [categories, tags] = await Promise.all([markdownApi.categories(), markdownApi.tags()]);
      setAccountCategories(categories);
      setAccountTags(tags);
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "research-pane", step: "taxonomy" });
    }
  }, []);

  useEffect(() => {
    void loadTaxonomy();
  }, [loadTaxonomy]);

  // Refetch the list when filters change (debounced so typing search doesn't
  // fire a request per keystroke).
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
  // Dual-mode selection: the open document's id lives in the URL (URL-driven, deep-linkable) when
  // `urlSelection` is passed, else internal state (embedded).
  const { selectedId, select: openDoc } = useDualModeSelection(
    urlSelection && { selectedId: urlSelection.docId ?? null, onSelect: urlSelection.onSelectDoc },
  );
  // Creating a document is a MODAL over the stack, never a blank leaf (HTD recipe
  // `must-create-in-modal`): the `+` opens it, and on save the created doc is selected so its
  // full editor (body, publish) opens.
  const [newOpen, setNewOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<ResearchDocument | null>(null);
  const [draft, setDraft] = useState<ResearchInput | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Guards against an out-of-order body fetch clobbering a newer selection.
  const selectToken = useRef(0);
  // The doc id currently hydrated into the form. The URL-sync effect skips re-fetching
  // when it already matches — e.g. right after create seeds the returned doc — so a
  // just-opened doc doesn't flash to "Loading…" + issue a redundant GET.
  const loadedIdRef = useRef<string | null>(null);
  // Re-entrancy latch for `onSave`. The `saving` STATE can't do this job: it is a render value,
  // so two activations inside a single commit (a double-click on Save before React paints the
  // disabled button) both read the pre-save `false` and both PUT. A ref flips synchronously on
  // the way in and clears in `finally`.
  const savingRef = useRef(false);

  const baseline: ResearchInput | null = selectedDoc ? researchToInput(selectedDoc) : null;
  const dirty = Boolean(draft && baseline && researchDiffers(draft, baseline));
  const validationError = draft ? researchValidate(draft) : null;
  // Dirty AND valid — `!loadingDoc` stays because it is a DATA-AVAILABILITY term (there is no
  // baseline to diverge from until the body has landed), not a busy term. The busy/saving term is
  // applied at the button: `SaveCancelButtons` already renders `disabled={!canSave || saving}`, so
  // folding `!saving` in here would express the same rule twice — and that duplicate is what
  // previously stood in for the missing re-entrancy latch in `onSave`.
  const canSave = Boolean(draft && baseline) && dirty && validationError === null && !loadingDoc;
  const canDelete = selectedId !== null && !saving && !deleting;

  // Load a document's body into the form (or clear it when id is null). Token-guarded so an
  // out-of-order fetch can't clobber a newer selection. Shared by the embedded `select` (which
  // loads synchronously on click) and the URL-driven effect (deep-link / reload / Back).
  const loadBody = useCallback(
    async (id: string | null) => {
      const token = ++selectToken.current;
      loadedIdRef.current = id; // the form is now bound to `id` (see the URL-sync effect guard)
      setSelectedDoc(null);
      setDraft(null);
      setFormError(null);
      if (id == null) {
        setLoadingDoc(false);
        return;
      }
      setLoadingDoc(true);
      try {
        const full = await markdownApi.get(id, { workspace: workspaceSlug });
        if (selectToken.current !== token) return; // a newer selection won
        setSelectedDoc(full);
        setDraft(researchToInput(full));
      } catch (err) {
        if (selectToken.current !== token) return;
        reportUnexpectedAuthError(err, { feature: "research-pane", step: "open" });
        setFormError(errorText(err, "Failed to open the document."));
      } finally {
        if (selectToken.current === token) setLoadingDoc(false);
      }
    },
    [workspaceSlug],
  );

  const select = useCallback(
    async (id: string) => {
      // URL-driven: `openDoc` navigates and the effect below loads the body for the new URL id.
      // Embedded: `openDoc` set the local selection — load the body synchronously now (legacy).
      openDoc(id);
      if (!urlSelection) await loadBody(id);
    },
    [urlSelection, loadBody, openDoc],
  );

  // URL-driven mode only: load (or clear) the document body when the open id in the URL changes — a
  // deep-link landing, reload, browser back/forward, or an in-app navigation. Inert when embedded,
  // where `select` loads synchronously instead.
  useEffect(() => {
    if (!urlSelection) return;
    const docId = urlSelection.docId ?? null;
    // Skip when the form is already bound to this id (e.g. create just seeded the returned doc, or
    // loadBody already ran for it) — avoids a redundant GET + a "Loading…" flash.
    if (loadedIdRef.current === docId) return;
    void loadBody(docId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSelection ? urlSelection.docId : null, loadBody]);

  function onChange(next: ResearchInput): void {
    setDraft(next);
    if (formError) setFormError(null);
  }

  function onCancel(): void {
    selectToken.current++;
    openDoc(null);
    setSelectedDoc(null);
    setDraft(null);
    setFormError(null);
    setLoadingDoc(false);
  }

  // Returns true once the draft is persisted (false on a validation/save failure) so the merged
  // stack's exit guard knows whether a gated navigation may proceed.
  async function onSave(): Promise<boolean> {
    if (!draft) return false;
    // Already in flight — swallow the duplicate. Reporting `false` is right for the exit guard
    // too: nothing has been persisted YET, so leaving now would still lose the edit.
    if (savingRef.current) return false;
    const problem = researchValidate(draft);
    if (problem) {
      setFormError(problem);
      return false;
    }
    const input = researchNormalize(draft);
    savingRef.current = true;
    setSaving(true);
    setFormError(null);
    try {
      // Create is a modal now (see the CreateResourceDialog below); onSave only ever UPDATES the
      // open document.
      if (selectedId) {
        const updated = await markdownApi.update(selectedId, toUpdateBody(input), {
          workspace: workspaceSlug,
        });
        await refresh();
        setSelectedDoc(updated);
        setDraft(researchToInput(updated));
      }
      return true;
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "research-pane", step: "save" });
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
      await markdownApi.remove(selectedId, { workspace: workspaceSlug });
      setPendingDelete(false);
      openDoc(null);
      setSelectedDoc(null);
      setDraft(null);
      await refresh();
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "research-pane", step: "delete" });
      setFormError(errorText(err, "Failed to delete."));
      setPendingDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  // Publish/unpublish returns the updated document; keep the selection + list in sync.
  async function onPublishChanged(updated: ResearchDocument): Promise<void> {
    setSelectedDoc(updated);
    await refresh();
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const rows = docs ?? [];
  const items: TopicDetailItem[] = rows.map((d) => ({
    id: d.id,
    label: d.title || "Untitled",
    // The icon carries the row's one discrete state: published (visible to the world) vs a
    // private draft document. Matches the "Published" sublabel tag.
    icon: d.visibility === "public" ? <Globe /> : <FileText />,
    sublabel:
      [d.category, d.visibility === "public" ? "Published" : null].filter(Boolean).join(" · ") ||
      (d.tags.length > 0 ? d.tags.join(", ") : undefined),
  }));
  const validationHint = draft && dirty ? validationError : null;
  const editing = selectedId !== null;

  // PUBLISH the documents list into the workspace shell's ONE merged stack (like the sibling
  // ecosystem panes) instead of a self-contained nested EditorSection: the list is a rail LEVEL
  // whose header carries the search/category/tag filters (railSlot) and the "+" create affordance.
  const documentsLevel: TopicLevel = {
    id: "research-documents",
    title: "Documents",
    items,
    selectedId,
    onSelect: (id) => void select(id),
    onClear: onCancel,
    onNew: () => setNewOpen(true),
    newLabel: "New document",
    emptyLabel: docs === null ? "Loading…" : "No documents yet.",
    railSlot: (
      <ResearchFilters
        filters={filters}
        onChange={setFilters}
        categories={categoriesOf(universe)}
        tags={tagsOf(universe)}
      />
    ),
  };
  useStackLevel(documentsLevel);
  // The open editor's unsaved-work guard, so Back / breadcrumb-up / a sibling click prompts
  // Save/Discard/Cancel. Live only while an editor is open; `save()` returns success.
  useWorkspaceExitGuard(editing ? { isDirty: () => dirty, save: () => onSave() } : null);

  // The host-injected per-record affordance (the hub's api-explorer button); null on
  // a standalone feature site → the trailing slot renders nothing.
  const renderRecordAffordance = useRecordAffordance();

  // The frontier leaf: a portaled Save/Cancel/Delete bar over the editor (or a placeholder). The
  // list itself lives in the published rail above, so this renders ONLY the editor half.
  const actions: MasterDetailActions = {
    onCreate: () => setNewOpen(true),
    createLabel: "New document",
    onCancel,
    canCancel: editing,
    onSave: () => void onSave(),
    canSave,
    saving,
    onDelete: requestDelete,
    canDelete,
    // ResearchPane owns its own (document-specific) delete confirm modal below, so the bar's
    // generic confirm stays off (deletePrompt null) — its Delete button just opens ours.
    deletePrompt: null,
  };

  return (
    <>
      <MasterDetailLeaf
        form={{ actions, editing, draft }}
        trailing={renderRecordAffordance?.({
          path: "/content/markdown/{id}",
          pathValues: { id: selectedId },
          title: "Research document API",
        })}
        error={listError ?? formError}
        emptyTitle={
          loadingDoc || docs === null
            ? "Loading…"
            : "Select a document to edit, or create a new one."
        }
        renderDetail={(d) => (
          <div className="flex flex-col gap-4">
            {loadingDoc ? (
              <p className="text-sm text-apt-text-muted">Loading…</p>
            ) : (
              <>
                <ResearchDetail
                  draft={d}
                  onChange={onChange}
                  categoryOptions={accountCategories}
                  tagOptions={accountTags}
                  error={validationHint}
                />
                {selectedDoc && (
                  <PublishSection
                    key={selectedDoc.id}
                    doc={selectedDoc}
                    userSlug={userSlug}
                    workspaceSlug={workspaceSlug}
                    onChanged={onPublishChanged}
                  />
                )}
              </>
            )}
          </div>
        )}
      />

      {/* Create is a scoped modal: title + category only (HTD recipe `must-create-in-modal`). The
          body is written in the editor that opens once the created doc is selected — the backend
          accepts an empty body on create, so the doc exists immediately and the editor fills it. */}
      {newOpen && (
        <CreateResourceDialog<ResearchPlacement, ResearchDocument>
          ariaLabel="New document"
          heading="New document"
          blank={() => ({ title: "", category: "" })}
          validate={(d) =>
            !d.title.trim()
              ? "A title is required."
              : d.category.length > 200
                ? "Category must be 200 characters or fewer."
                : null
          }
          create={(d) =>
            markdownApi.create(
              toCreateBody(researchNormalize({ title: d.title, content: "", category: d.category, tags: [] })),
              { workspace: workspaceSlug },
            )
          }
          onClose={() => setNewOpen(false)}
          onCreated={(created) => {
            setNewOpen(false);
            void refresh();
            // Open the created doc: URL-driven navigates to /research/<id>, embedded sets local
            // state. Seed doc/draft + mark it loaded so the URL-sync effect skips re-fetching it.
            loadedIdRef.current = created.id;
            openDoc(created.id);
            setSelectedDoc(created);
            setDraft(researchToInput(created));
            setFormError(null);
          }}
          renderForm={(draft, onChange, error) => (
            <>
              <Field label="Title">
                <Input
                  /* eslint-disable-next-line jsx-a11y/no-autofocus -- focus the first field on open */
                  autoFocus
                  value={draft.title}
                  placeholder="Untitled document"
                  onChange={(e) => onChange({ ...draft, title: e.target.value })}
                />
              </Field>
              <Field label="Category" hint="Optional — group the document; you can change it later.">
                <Input
                  value={draft.category}
                  placeholder="e.g. Research notes"
                  onChange={(e) => onChange({ ...draft, category: e.target.value })}
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
        title="Delete document?"
        description="This soft-deletes the document. Its public route, if any, is freed."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={cancelDelete}
      />
    </>
  );
}
