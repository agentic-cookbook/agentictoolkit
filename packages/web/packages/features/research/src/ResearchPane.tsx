"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { reportUnexpectedAuthError, useAuth } from "@agentic-toolkit/auth";
import { AlertModal } from "@agentic-toolkit/ui/components/alert-modal";
import type { TopicDetailItem, TopicLevel } from "@agentic-toolkit/ui/blocks";
import { useDualModeSelection } from "@agentic-toolkit/ui/hooks/useDualModeSelection";
import { slugify } from "@agentic-toolkit/ui/lib/slug";
import {
  useStackLevel,
  useRailExitGuard as useWorkspaceExitGuard,
  MasterDetailLeaf,
  useRecordAffordance,
  type MasterDetailActions,
} from "@agentic-toolkit/resource";
import {
  markdownApi,
  type ResearchDocument,
  type ResearchSummary,
} from "@agentic-toolkit/data/markdown";
import {
  categoriesOf,
  researchBlank,
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

// Synthetic selection id for the unsaved "new document" draft, so EditorSection
// (which derives `editing` from a non-null selectedId) shows the editor while no
// real row is selected. It can never collide with a row id (rows are UUIDs).
const DRAFT_ID = "__draft__";
const EMPTY_FILTERS: FilterState = { q: "", category: "", tag: "" };

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
  // `urlSelection` is passed, else internal state (embedded). `creating` (a new draft, no id yet)
  // stays LOCAL in both modes — a draft has no URL/id to address, so we never route on create.
  const { selectedId, select: openDoc } = useDualModeSelection(
    urlSelection && { selectedId: urlSelection.docId ?? null, onSelect: urlSelection.onSelectDoc },
  );
  const [creating, setCreating] = useState(false);
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

  const baseline: ResearchInput | null = creating
    ? researchBlank()
    : selectedDoc
      ? researchToInput(selectedDoc)
      : null;
  const dirty = Boolean(draft && baseline && researchDiffers(draft, baseline));
  const validationError = draft ? researchValidate(draft) : null;
  const canSave = Boolean(draft && baseline) && dirty && validationError === null && !saving && !loadingDoc;
  const canDelete = selectedId !== null && !creating && !saving && !deleting;

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
      // Clearing `creating` too, so clicking a row while a new draft is open opens that doc (the
      // effect is gated on !creating). URL-driven: `openDoc` navigates and the effect below loads
      // the body for the new URL id. Embedded: `openDoc` set the local selection — load the body
      // synchronously now (legacy behavior).
      setCreating(false);
      openDoc(id);
      if (!urlSelection) await loadBody(id);
    },
    [urlSelection, loadBody, openDoc],
  );

  // URL-driven mode only: load (or clear) the document body when the open id in the URL changes — a
  // deep-link landing, reload, browser back/forward, or an in-app navigation. Never disturbs an
  // in-progress create (a new draft owns the form until it is saved or cancelled). Inert when
  // embedded, where `select` loads synchronously instead.
  useEffect(() => {
    if (!urlSelection || creating) return;
    const docId = urlSelection.docId ?? null;
    // Skip when the form is already bound to this id (e.g. create just seeded the returned doc, or
    // loadBody already ran for it) — avoids a redundant GET + a "Loading…" flash.
    if (loadedIdRef.current === docId) return;
    void loadBody(docId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSelection ? urlSelection.docId : null, creating, loadBody]);

  function onNew(): void {
    selectToken.current++; // cancel any in-flight body fetch
    setCreating(true);
    // A new draft has no id/URL to address, so we don't route on create (matches PersonasSection).
    // URL-driven mode keeps the current URL put; `creating` masks it (the master list shows the
    // draft slot). Embedded mode clears its own selection here.
    if (!urlSelection) openDoc(null);
    setSelectedDoc(null);
    setDraft(researchBlank());
    setFormError(null);
    setLoadingDoc(false);
  }

  function onChange(next: ResearchInput): void {
    setDraft(next);
    if (formError) setFormError(null);
  }

  function onCancel(): void {
    selectToken.current++;
    setCreating(false);
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
    const problem = researchValidate(draft);
    if (problem) {
      setFormError(problem);
      return false;
    }
    const input = researchNormalize(draft);
    setSaving(true);
    setFormError(null);
    try {
      if (creating) {
        const created = await markdownApi.create(toCreateBody(input), {
          workspace: workspaceSlug,
        });
        await refresh();
        setCreating(false);
        // Open the created doc: URL-driven navigates to /research/<id>, embedded sets local state.
        // Seed doc/draft + mark it loaded so the URL-sync effect skips re-fetching it (no flash).
        loadedIdRef.current = created.id;
        openDoc(created.id);
        setSelectedDoc(created);
        setDraft(researchToInput(created));
      } else if (selectedId) {
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
    sublabel:
      [d.category, d.visibility === "public" ? "Published" : null].filter(Boolean).join(" · ") ||
      (d.tags.length > 0 ? d.tags.join(", ") : undefined),
  }));
  const validationHint = draft && dirty ? validationError : null;
  const editing = creating || selectedId !== null;

  // PUBLISH the documents list into the workspace shell's ONE merged stack (like the sibling
  // ecosystem panes) instead of a self-contained nested EditorSection: the list is a rail LEVEL
  // whose header carries the search/category/tag filters (railSlot) and the "+" create affordance.
  const documentsLevel: TopicLevel = {
    id: "research-documents",
    title: "Documents",
    items,
    selectedId: creating ? DRAFT_ID : selectedId,
    onSelect: (id) => void select(id),
    onClear: onCancel,
    onNew,
    newLabel: "New document",
    newActive: creating,
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
    onCreate: onNew,
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
        trailing={
          creating
            ? renderRecordAffordance?.({
                method: "POST",
                path: "/content/markdown",
                pathValues: {},
                title: "Create document API",
              })
            : renderRecordAffordance?.({
                path: "/content/markdown/{id}",
                pathValues: { id: selectedId },
                title: "Research document API",
              })
        }
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
                {!creating && selectedDoc && (
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
