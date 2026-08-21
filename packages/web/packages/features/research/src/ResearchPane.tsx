"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Globe, Plus } from "lucide-react";

import { reportUnexpectedAuthError, useAuth } from "@agentic-toolkit/auth";
import { AlertModal } from "@agentic-toolkit/ui/components/alert-modal";
import type { TopicDetailItem, TopicLevel } from "@agentic-toolkit/ui/blocks";
import { Field } from "@agentic-toolkit/ui/blocks";
import { Button } from "@agentic-toolkit/ui/components/button";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Textarea } from "@agentic-toolkit/ui/components/textarea";
import { useDualModeSelection } from "@agentic-toolkit/ui/hooks/useDualModeSelection";
import { slugify } from "@agentic-toolkit/ui/lib/slug";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import {
  useStackLevel,
  useRailExitGuard as useWorkspaceExitGuard,
  MasterDetailLeaf,
  useRecordAffordance,
  CreateResourceDialog,
  useResourceItem,
  HomeBar,
  HomeBarPortal,
  type MasterDetailActions,
} from "@agentic-toolkit/resource";
import {
  revalidateResources,
  useResourceItemPrefetch,
  useResourceItemWriter,
  useResourceList,
} from "@agentic-toolkit/data";
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

/** The create modal's draft (HTD recipe `must-create-in-modal` +
 *  `must-scope-create-modal-to-placement`): the body, plus the category that PLACES it.
 *
 *  The body is here rather than left to the editor because it is now the document's NAME —
 *  the title is derived from its first line — so a create with an empty body would mint an
 *  "Untitled" row the user then has to go and find. */
interface ResearchPlacement {
  content: string;
  category: string;
}

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
 * The /research workspace: a master/detail surface over the signed-in user's
 * markdown research documents. This pane owns the data (list/search + the full
 * document loaded on selection) and the form state (selection, draft, dirty/
 * validity, save/delete); the fields-only editor, the publish concern, and the
 * filters are their own components, and the two-pane layout + toolbar are the
 * shared EditorSection block.
 *
 * DUAL SELECTION MODE (mirrors PersonasSection): pass `urlSelection` and the open document lives in
 * the URL + is deep-linkable — the `/<slug>/research` route wires this via {@link ResearchFeature}.
 * Omit it and selection is internal state, so opening a document happens IN PLACE without
 * navigating away. NOTHING mounts that second mode today: the hub's `renderFeaturePanel("research")`
 * arm (`sites/hub/src/components/workspace/feature-panels.tsx`) is unreached — `research` is in no
 * ecosystem or product topic list and is off the hub's workspace feature rail — so this pane is a
 * LEVEL-0 surface in practice, which is what lets it publish into the page's home bar
 * unconditionally (see the `HomeBarPortal` below). An embedded mount would put a deeper,
 * selection-scoped pane's filters into the HOST page's bar beside that page's own controls; if one
 * is ever added, gate the publish on `urlSelection` before wiring it.
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
  // Two filter values, not one. `filters` is what the inputs show and changes on every keystroke;
  // `applied` is what the list READS, and lags it by the debounce. The debounce used to sit on the
  // request; it now sits on the query key, which is the same 200ms of typing without a request —
  // and the key is what lets a filter set returned to paint from cache instead of re-reading.
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<FilterState>(EMPTY_FILTERS);
  useEffect(() => {
    const id = setTimeout(
      () => setApplied((prev) => (sameFilters(prev, filters) ? prev : filters)),
      200,
    );
    return () => clearTimeout(id);
  }, [filters]);

  // Every read here reports under THIS pane's step and rethrows, which is why each call site
  // passes `reportErrors: false` — one failure reported twice, under two contexts, is worse than
  // one.
  const loadDocs = useCallback(async () => {
    try {
      return await markdownApi.list(applied, { workspace: workspaceSlug });
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "research-pane", step: "list" });
      throw err instanceof Error ? err : new Error("Failed to load documents.");
    }
  }, [applied, workspaceSlug]);

  // Keyed by the FILTERS as well as the workspace: each filter set is its own list, so clearing a
  // search and going back to it is a repaint rather than a round trip.
  const listPrefix = `research:${workspaceSlug ?? ""}:list:`;
  const listKey = `${listPrefix}${applied.q}|${applied.category}|${applied.tag}`;
  const {
    items: docs,
    error: listError,
    reload: reloadDocs,
  } = useResourceList<ResearchSummary>(listKey, loadDocs, { reportErrors: false });

  const loadUniverse = useCallback(async () => {
    try {
      return await markdownApi.list({}, { workspace: workspaceSlug });
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "research-pane", step: "universe" });
      throw err;
    }
  }, [workspaceSlug]);

  // The unfiltered universe, only for the filter dropdown options — so narrowing
  // the list (which refetches `docs`) never empties its own category/tag menus.
  const { items: universeDocs, reload: reloadUniverse } = useResourceList<ResearchSummary>(
    `research:${workspaceSlug ?? ""}:universe`,
    loadUniverse,
    { reportErrors: false },
  );
  const universe = universeDocs ?? [];

  // The account's existing categories + tags — the editor's autocomplete/browse source
  // (distinct from the home bar's filter dropdowns, whose options come from `universe` above).
  // Refetched on save so a freshly-coined category/tag appears as a suggestion next time.
  //
  // Workspace-scoped like the documents themselves: the backend scopes the category/tag
  // vocabulary to the same owner it scopes the docs to, so omitting the workspace here
  // suggested the CALLER's own labels while the list showed the ORG's documents.
  //
  // Two lists rather than the one `Promise.all` this replaced: they are two routes, they cache
  // separately, and the pair fetches in parallel either way.
  const loadCategories = useCallback(async () => {
    try {
      return await markdownApi.categories({ workspace: workspaceSlug });
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "research-pane", step: "taxonomy" });
      throw err;
    }
  }, [workspaceSlug]);
  const loadTags = useCallback(async () => {
    try {
      return await markdownApi.tags({ workspace: workspaceSlug });
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "research-pane", step: "taxonomy" });
      throw err;
    }
  }, [workspaceSlug]);

  const { items: categoryOptions, reload: reloadCategories } = useResourceList<string>(
    `research:${workspaceSlug ?? ""}:categories`,
    loadCategories,
    { reportErrors: false },
  );
  const { items: tagOptions, reload: reloadTags } = useResourceList<string>(
    `research:${workspaceSlug ?? ""}:tags`,
    loadTags,
    { reportErrors: false },
  );
  const accountCategories = categoryOptions ?? [];
  const accountTags = tagOptions ?? [];

  // Swallowing, and it has to: every caller re-reads AFTER its own write succeeded, and their
  // catch blocks say "Failed to save." / "Failed to delete.". A failed re-read is neither. The
  // list's failure still reaches the screen, as `listError`.
  const refresh = useCallback(() => {
    // The SIBLING filter keys first. `reloadDocs` re-reads the one filter set on screen, but a save
    // changes the very fields the other keys are built from — a document's category and its tags —
    // so every other cached filter set for this workspace is now potentially wrong. Without this,
    // clearing a search back to a filter visited earlier repaints the document under labels it no
    // longer has, from cache, with no read. Unmounted lists are only marked stale, so this issues
    // no request; the key on screen is excluded because `reloadDocs` already re-reads it and
    // invalidating it too would cancel that read and start a second one.
    revalidateResources((key) => key !== listKey && key.startsWith(listPrefix));
    return Promise.all([reloadDocs(), reloadUniverse(), reloadCategories(), reloadTags()])
      .then(() => undefined)
      .catch(() => {});
  }, [reloadDocs, reloadUniverse, reloadCategories, reloadTags, listKey, listPrefix]);

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
  const [saving, setSaving] = useState(false);
  // A failed save or delete belongs to the DOCUMENT it was raised on, so it is stored with that
  // id and read back only while that document is still open. The loader this pane used to own
  // cleared the message on every selection change; deriving it does the same thing for the URL
  // path too (Back, a deep link), which never ran through a click handler that could clear it.
  const [raisedError, setRaisedError] = useState<{ id: string | null; text: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Re-entrancy latch for `onSave`. The `saving` STATE can't do this job: it is a render value,
  // so two activations inside a single commit (a double-click on Save before React paints the
  // disabled button) both read the pre-save `false` and both PUT. A ref flips synchronously on
  // the way in and clears in `finally`.
  const savingRef = useRef(false);

  // ── The open document ─────────────────────────────────────────────────────
  // Cached per WORKSPACE, because `?workspace=` decides which principal's copy a read returns —
  // one key for a document id would let an org workspace paint the caller's own copy of it.
  const docCacheKey = `research:${workspaceSlug ?? ""}`;
  const loadDoc = useCallback(
    (id: string) => markdownApi.get(id, { workspace: workspaceSlug }),
    [workspaceSlug],
  );
  // Replaces the loader this pane used to hand-roll: a `loadBody` + an out-of-order token + a
  // "which id is the form bound to" ref + a URL-sync effect that had to remember to skip itself.
  // All four existed to answer "is what's on screen the right document"; the cache answers it, and
  // a document opened a second time now paints from memory instead of from a GET.
  //
  // No `seedFrom`: a list row is a ResearchSummary, which carries no body, so there is no partial
  // ResearchDocument to paint. And no `absent`: this list is FILTERED, so a document missing from
  // it has merely been narrowed away — announcing that as a deletion would be a lie the user
  // cannot argue with. The 404 is the honest signal, and it is the one that fires on a real one.
  const {
    item: selectedDoc,
    isSettled,
    isFetching: fetchingDoc,
    error: docError,
  } = useResourceItem<ResearchDocument>(docCacheKey, selectedId, loadDoc);
  const prefetchDoc = useResourceItemPrefetch(docCacheKey, loadDoc);
  const writeDoc = useResourceItemWriter<ResearchDocument>(docCacheKey);

  // The server's copy, as the form would hold it.
  const baseline = useMemo(
    () => (selectedDoc ? researchToInput(selectedDoc) : null),
    [selectedDoc],
  );
  // The user's in-progress edits, or null when the form is simply showing what the server has.
  //
  // It carries the id it belongs to, and the draft is DERIVED from it rather than copied into
  // state — which is what makes the whole "instant paint, revalidate behind it" flow safe with no
  // effect at all. A revalidation landing under a user who is not typing is adopted immediately;
  // one landing under a user who IS typing loses to the override; and a selection change discards
  // it, because an override for another document is not this document's draft.
  const [override, setOverride] = useState<{ id: string; value: ResearchInput } | null>(null);
  const draft = override && override.id === selectedId ? override.value : baseline;

  // The scoped read/write pair for `raisedError` above. Clearing is unscoped on purpose: there is
  // only ever one message, so "no error" needs no id to be about.
  const formError = raisedError && raisedError.id === selectedId ? raisedError.text : null;
  const setFormError = useCallback(
    (text: string | null) => setRaisedError(text === null ? null : { id: selectedId, text }),
    [selectedId],
  );

  const dirty = Boolean(draft && baseline && researchDiffers(draft, baseline));
  const validationError = draft ? researchValidate(draft) : null;
  // Dirty AND valid AND settled. `isSettled` is the successor to the old `!loadingDoc` term and
  // carries one more rule with it: a save composed against a CACHED copy would PUT fields the
  // server has since changed. The busy/saving term is applied at the button — `SaveCancelButtons`
  // already renders `disabled={!canSave || saving}` — so folding `!saving` in here would express
  // the same rule twice.
  const canSave = Boolean(draft && baseline) && dirty && validationError === null && isSettled;
  // Delete waits on the same signal for the same reason: it is a write against a copy that may
  // already be out of date.
  const canDelete = selectedId !== null && isSettled && !saving && !deleting;

  const select = useCallback(
    (id: string) => {
      // URL-driven: navigate, and the hook re-reads for the new URL id. Embedded: local selection,
      // same hook, same re-read. Deep-link, reload and Back all arrive the same way — there is no
      // longer a second path that loads the body, so there is nothing for the two to disagree on.
      openDoc(id);
    },
    [openDoc],
  );

  function onChange(next: ResearchInput): void {
    if (!selectedId) return;
    setOverride({ id: selectedId, value: next });
    if (formError) setFormError(null);
  }

  function onCancel(): void {
    openDoc(null);
    setOverride(null);
    setFormError(null);
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
        // The response IS the server's copy, so record it rather than invalidating — a re-read
        // would spend a request to arrive back at these exact bytes. Dropping the override then
        // hands the form straight back to `baseline`, which is now what we just saved.
        writeDoc(updated.id, updated);
        setOverride(null);
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
      // Forget the body BEFORE leaving. Keeping it would paint a document we know is gone if the
      // user navigated back to its URL, and only the GET behind that paint would take it away.
      writeDoc(selectedId, null);
      openDoc(null);
      setOverride(null);
      await refresh();
    } catch (err) {
      reportUnexpectedAuthError(err, { feature: "research-pane", step: "delete" });
      setFormError(errorText(err, "Failed to delete."));
      setPendingDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  // Publish/unpublish returns the updated document; keep the cached copy + list in sync.
  async function onPublishChanged(updated: ResearchDocument): Promise<void> {
    writeDoc(updated.id, updated);
    await refresh();
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const rows = docs ?? [];
  const items: TopicDetailItem[] = rows.map((d) => ({
    id: d.id,
    label: d.title || "Untitled",
    // No leading icon (the level opts out) and no "Published" tag in the sublabel: a row has
    // exactly ONE discrete state, and it is marked ONCE, at the trailing edge. The sublabel is
    // left to say what the row IS — its category, else its tags — which is the only thing the
    // title cannot. The globe is aria-hidden, so the state rides an sr-only word instead: an
    // icon alone is a colour-only signal, and `trailing` renders AFTER the label, which is
    // where an accessible name wants it.
    trailing:
      d.visibility === "public" ? (
        <>
          <span className="sr-only">, published</span>
          <Globe size={14} aria-hidden className="text-apt-text-dim" />
        </>
      ) : undefined,
    sublabel: d.category || (d.tags.length > 0 ? d.tags.join(", ") : undefined),
  }));
  const validationHint = draft && dirty ? validationError : null;
  const editing = selectedId !== null;

  // PUBLISH the documents list into the workspace shell's ONE merged stack (like the sibling
  // ecosystem panes) instead of a self-contained nested master/detail pane: the list is a rail
  // LEVEL and NOTHING ELSE — selection, prefetch, the busy spinner and the empty text. Its two
  // page-level controls (the search/category/tag filters and the "New document" create) are
  // published into the HOME BAR instead; see the `HomeBarPortal` at the top of the return below.
  const documentsLevel: TopicLevel = {
    id: "research-documents",
    title: "Documents",
    items,
    selectedId,
    onSelect: (id) => select(id),
    // Hovering (or tabbing to) a row for a moment warms its body, so the click that follows has
    // nothing left to wait for.
    onPrefetch: prefetchDoc,
    // The spinner in front of "Documents" — the one signal that a read is happening, now that the
    // editor paints the cached copy instead of blanking to "Loading…".
    busy: fetchingDoc,
    onClear: onCancel,
    // `emptyLabel` STAYS: it is the rail's own text for an empty list, not a control.
    emptyLabel: docs === null ? "Loading…" : "No documents yet.",
    // A document row's identity is its title; it has no icon worth a column of its own, and the
    // published state it used to show there is now the row's `trailing` mark.
    hideItemIcons: true,
  };
  useStackLevel(documentsLevel);
  // Registered only while DIRTY (see useMasterDetailLevel) so the host's guard count is a
  // render-value dirty signal. `editing` is implied: a draft cannot be dirty with no editor open.
  useWorkspaceExitGuard(dirty ? { isDirty: () => dirty } : null);

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
      {/* The page's own controls, published into the HOME BAR — the strip between the workspace bar
          and the breadcrumb bar. They sit outside the rail because they act on the LIST AS A WHOLE
          (this pane IS the research site's /home), not on whichever level the rail happens to be
          showing, which is the fleet's placement rule for the bar. `left` is search/filters,
          `right` the primary action; `HomeBar` owns that arrangement so no caller re-derives it.

          `ResearchFilters` goes in bare, with no wrapper of its own: `SearchFilterBar` draws only a
          `role="search"` flex row — no border, no background, no padding — so it does not repeat
          the strip `HomeBarHost` already draws around it (the doubled-border trap documented at
          `resource-explorer.tsx`'s own left slot).

          UNCONDITIONAL, exactly as the level's `onNew`/`railSlot` were: an empty document list is
          precisely when the first create matters most, and a filter with nothing to narrow yet is
          harmless. Portalled children stay in this component's REACT tree, so both controls still
          drive `filters`/`newOpen` from here. */}
      <HomeBarPortal>
        <HomeBar
          left={
            <ResearchFilters
              filters={filters}
              onChange={setFilters}
              categories={categoriesOf(universe)}
              tags={tagsOf(universe)}
            />
          }
          right={
            <Button variant="outline" size="sm" onClick={() => setNewOpen(true)}>
              {/* `data-icon="inline-start"` and no `size`: `Button` sizes its own icons and
                  tightens the padding on the icon's side. See `resource-explorer.tsx`. */}
              <Plus data-icon="inline-start" aria-hidden />
              New document
            </Button>
          }
        />
      </HomeBarPortal>

      <MasterDetailLeaf
        fill
        form={{ actions, editing, draft }}
        trailing={renderRecordAffordance?.({
          path: "/content/markdown/{id}",
          pathValues: { id: selectedId },
          title: "Research document API",
        })}
        error={listError ?? formError ?? docError}
        emptyTitle={
          // Reached only with nothing cached for this id — otherwise `draft` is already the cached
          // document and the editor below renders instead.
          fetchingDoc || docs === null
            ? "Loading…"
            : "Select a document to edit, or create a new one."
        }
        // Publishing is the pane's FLOOR, not the last thing under the body: it is about the
        // document as a whole, it is where the public URL is read off, and it must not walk up
        // and down the pane with the length of what you are writing.
        footer={
          selectedDoc && (
            <PublishSection
              key={selectedDoc.id}
              doc={selectedDoc}
              userSlug={userSlug}
              workspaceSlug={workspaceSlug}
              onChanged={onPublishChanged}
              disabled={!isSettled}
            />
          )
        }
        renderDetail={(d) => (
          // No "Loading…" branch: whatever is cached is on screen from the first frame, and the
          // read settles behind it. `disabled` is what makes that safe — see `isSettled`.
          <ResearchDetail
            draft={d}
            onChange={onChange}
            categoryOptions={accountCategories}
            tagOptions={accountTags}
            error={validationHint}
            disabled={!isSettled}
          />
        )}
      />

      {/* Create is a scoped modal: the body + the category that places it (HTD recipe
          `must-create-in-modal`). The editor that opens on the created doc is where the body is
          FINISHED; it starts here because the first line is the document's title. */}
      {newOpen && (
        <CreateResourceDialog<ResearchPlacement, ResearchDocument>
          ariaLabel="New document"
          heading="New document"
          blank={() => ({ content: "", category: "" })}
          validate={(d) =>
            !d.content.trim()
              ? "A document body is required."
              : d.category.length > 200
                ? "Category must be 200 characters or fewer."
                : null
          }
          create={(d) =>
            markdownApi.create(
              toCreateBody(researchNormalize({ content: d.content, category: d.category, tags: [] })),
              { workspace: workspaceSlug },
            )
          }
          onClose={() => setNewOpen(false)}
          onCreated={(created) => {
            setNewOpen(false);
            void refresh();
            // Record the created document BEFORE selecting it, so the editor it opens into paints
            // from the cache with no read at all — the create response already is the server's
            // copy. (This is what the old `loadedIdRef` dance was for.)
            writeDoc(created.id, created);
            openDoc(created.id);
            setOverride(null);
            setFormError(null);
          }}
          renderForm={(draft, onChange, error) => (
            <>
              <Field label="Body" hint="The first line becomes the document's title.">
                <Textarea
                  /* eslint-disable-next-line jsx-a11y/no-autofocus -- focus the first field on open */
                  autoFocus
                  rows={6}
                  value={draft.content}
                  placeholder={"# My research\n\nWrite or paste markdown here."}
                  onChange={(e) => onChange({ ...draft, content: e.target.value })}
                />
              </Field>
              <Field label="Category" hint="Optional — group the document; you can change it later.">
                <Input
                  value={draft.category}
                  placeholder="e.g. Research notes"
                  onChange={(e) => onChange({ ...draft, category: e.target.value })}
                />
              </Field>
              <ErrorText error={error} />
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
