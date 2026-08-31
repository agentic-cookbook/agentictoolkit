'use client';

import { useCallback, useRef, useState } from 'react';
import {
  revalidateResourceItems, revalidateResources, useResourceItemQuery,
} from '@agentic-toolkit/data';
import type { FieldDefDraft } from '@agentic-toolkit/registry/editors';
import {
  type FieldDefRow, type RegistryClient, type RegistryRow, type SectionRow,
} from '@agentic-toolkit/registry/client';
import { MY_ENTRY_CACHE_KEY, registryEntriesKey } from './entriesCache';
import { keyProblem, slugify } from './slug';
import { useRegistryClient } from './useRegistryClient';
import { REGISTRY_FORM_CACHE_KEY } from './useRegistryForm';

/**
 * One open registry's editable draft — the whole of what the builder used to hold in its own
 * component body, lifted out so that several topic panels can edit ONE draft.
 *
 * The explorer renders a registry's topics as siblings (Details, one per section, Pending), and
 * they share a single Save. State that lives in any one of them is state the others cannot see,
 * so it lives here instead and each panel takes the pieces it renders. Every business rule below
 * is carried over unchanged from the builder this replaced; the only thing that genuinely changes is
 * the id becoming optional, because "no registry selected" is now a state the explorer has and
 * a route-level remount no longer is.
 */

// A stable, row-scoped identity for React's key — independent of both array position and
// `field.id`. Position is out because `moveField()` can shift every OTHER unsaved field in the
// section too (it splices the whole section's peers to the tail of `draft.fields`), so a single
// reorder can hand two unsaved rows each other's old key. `field.id` is out because a
// just-created row does not have one yet, and once it does (after `save()` -> `reload()` re-fetches
// it), the row should keep the identity it already had rather than remount under a new one. A
// saved row's stable key is simply its own `id`, which is already permanent; only a brand-new,
// not-yet-saved row needs one minted, hence the counter. Not `crypto.randomUUID()`: unavailable
// in some test environments this repo runs under.
let nextFieldKey = 0;
function mintFieldKey(): string {
  return `new-${nextFieldKey++}`;
}

// `FieldDefDraft` (the toolkit's own local draft type, not ours to edit) types its own
// `visibility` as the client's `FieldVisibility` rather than `string`, so this local extension
// does not re-narrow it.
export type FieldDraft = FieldDefDraft & { sectionId: string; clientKey: string };

export interface RegistryDraftState {
  registry: RegistryRow;
  sections: SectionRow[];
  fields: FieldDraft[];
}

function toDraft(row: FieldDefRow): FieldDraft {
  return {
    id: row.id, sectionId: row.sectionId, key: row.key, type: row.type, label: row.label,
    help: row.help, required: row.required, visibility: row.visibility, config: row.config,
    sortOrder: row.sortOrder,
    showIf: row.showIf,
    clientKey: row.id,
  };
}

/**
 * Clears any remaining field's rule that names `removed`'s key, alongside removing `removed`
 * itself — a rule can outlive the field it names, and `evaluateShowIf` doesn't error on a
 * subject it can't resolve, it just silently keeps hiding the dependent field. Pure and
 * structural (matches on `showIf.field`, not on any particular field's identity) so it works
 * the same whether `removed` was ever saved or not.
 */
function removeFieldAndClearDependents(fields: FieldDraft[], removed: FieldDraft): FieldDraft[] {
  return fields
    .filter((f) => f !== removed)
    .map((f) => (f.showIf?.field === removed.key ? { ...f, showIf: null } : f));
}

export interface UseRegistryDraft {
  /** The client the panels hand on to anything that fetches for itself (the review queue). */
  client: RegistryClient;
  draft: RegistryDraftState | null;
  error: string | null;
  saving: boolean;
  dirty: boolean;
  /** Why this draft cannot be saved yet, in the owner's words, or `null`. See `draftBlock`. */
  saveBlock: string | null;
  setRegistry: (patch: Partial<RegistryRow>) => void;
  setField: (field: FieldDraft, next: FieldDefDraft) => void;
  addField: (sectionId: string) => void;
  deleteField: (field: FieldDraft) => Promise<void>;
  moveField: (field: FieldDraft, delta: number) => void;
  createSection: (label: string) => Promise<boolean>;
  /** Delete the open registry. REJECTS on failure rather than reporting through `error`, so
   *  the caller's own confirm dialog can keep the failure inside itself — the pane behind it
   *  is about to be navigated away from either way. */
  deleteRegistry: () => Promise<void>;
  /** Throw the draft's uncommitted edits away, back to what the last load returned. */
  revert: () => void;
  save: () => Promise<void>;
}

/**
 * The collection a registry's editable content is cached under. The registry row, its sections
 * and its field definitions are ONE cached item rather than three: they are always read
 * together, are only useful together, and every write below touches more than one of them.
 */
const REGISTRY_CONTENT_CACHE_KEY = 'registry-content';

/**
 * Why this draft cannot be saved yet, or `null`.
 *
 * A field def's `key` is validated by the server's own `SLUG_RE`, and until this existed nothing
 * on the way there checked it: `addField` mints `key: ''`, the Key box accepted whatever was
 * typed, and `canSave` asked only whether the draft was dirty. So Save ran the registry PATCH and
 * however many field writes came before the bad row, and only THEN got a bare 400 — leaving the
 * owner with a half-applied save and the message "invalid request body", which names neither the
 * field nor the rule.
 *
 * Checked here rather than in the panel because the panel renders ONE field and the rules are
 * about the draft: a duplicate key is a fact about two rows, and the ones that collide are
 * routinely in different sections, so no field's own pane can see it. `uq_field_defs_registry_key`
 * is per REGISTRY, which is why the duplicate scan is over `fields` rather than over a section's
 * peers.
 */
function draftBlock(draft: RegistryDraftState | null): string | null {
  if (!draft) return null;
  const seen = new Set<string>();
  for (const field of draft.fields) {
    const problem = keyProblem(field.key);
    if (problem) return `${field.label || 'A new field'}: ${problem}`;
    if (seen.has(field.key)) {
      return `Two fields share the key “${field.key}”. Every field in a registry needs its own.`;
    }
    seen.add(field.key);
  }
  return null;
}

export function useRegistryDraft(
  registryId: string | undefined,
  /**
   * The cache key the registries LIST rides — `basePath`, which is what `RegistryExplorer`
   * hands `useResourceList`. Required, and not derived: the two sweeps below matched
   * `key.endsWith('/registries')` until 2026-08-31, which is the hub's mount point written out
   * as a rule. On agenticdeveloperregistries.com the base is `/<workspace>` and that predicate
   * matches NOTHING, so a rename would have left the rail showing the old name and a delete
   * would have left the deleted row in it — both silent, both only on the other host.
   */
  listCacheKey: string,
  injected?: RegistryClient,
): UseRegistryDraft {
  const hookClient = useRegistryClient();
  const client = injected ?? hookClient;

  // What the owner has typed and NOT yet saved — nothing else. `null` means "no local edits",
  // which is what lets the draft below read straight through to the server's copy instead of
  // holding a duplicate of it. That split is the whole reason the server's copy can live in the
  // platform cache: a private second copy in this hook's own `useState` is precisely the thing
  // that would go stale behind it.
  const [edits, setEdits] = useState<RegistryDraftState | null>(null);
  const [saving, setSaving] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);

  const loadContent = useCallback(
    async (id: string): Promise<RegistryDraftState> => {
      const [registry, sections, fields] = await Promise.all([
        client.getRegistry(id),
        client.listSections(id),
        client.listFieldDefs(id),
      ]);
      return { registry, sections: sections.items, fields: fields.items.map(toDraft) };
    },
    [client],
  );

  // The platform cache — the same one the registry LIST already rides. These three requests used
  // to be re-issued cold every single time the owner clicked between topics of the SAME registry,
  // because the read lived in a `useEffect` whose only memory was this component's state; now the
  // first visit pays for them and every later one paints from the cache while it revalidates
  // behind the paint.
  //
  // It also owns, for free, the two guards this hook used to spell out with a token ref: a
  // response is stored under the id it was asked FOR, so a slow read for a registry the owner has
  // navigated away from can no longer land on the one they are looking at, and neither can its
  // rejection. `isSettled` is not read because nothing is seeded here — with no placeholder,
  // `item` is null until the server's own answer lands, so "not loaded yet" is still just a null
  // draft, exactly as the panels already render it.
  const { item: loaded, error: readError, reload } = useResourceItemQuery(
    REGISTRY_CONTENT_CACHE_KEY,
    registryId ?? null,
    loadContent,
  );

  // Selecting a different registry used to be a REMOUNT: the route keyed the builder on the id,
  // so nothing of the old registry could survive into the new one. The explorer keeps one
  // component mounted across that switch, and the cache keeps the SERVER's half apart by id on
  // its own — but the unsaved half is this hook's, so it is dropped here, during render, which is
  // the supported way to adjust state when a prop changes. An effect would be a frame too late,
  // and that frame renders the PREVIOUS registry's edits under the new id — a Save in it would
  // PATCH the new registry with the old registry's data.
  const [shownId, setShownId] = useState(registryId);
  if (registryId !== shownId) {
    setShownId(registryId);
    setEdits(null);
    setWriteError(null);
    setSaving(false);
  }

  /** What the panels render and edit: the owner's uncommitted copy once there is one, and the
   *  cache's copy until then. */
  const draft = edits ?? loaded;

  // A failed write outranks a failed read: it is the answer to something the owner just did, and
  // it is the one they are waiting on.
  const error = writeError ?? readError;

  // Every mutator below goes through this rather than touching `setEdits`: it starts the local
  // copy off from whatever is on screen, which the first time anything is typed is the cache's.
  // NOT stable across a fresh read, and every caller below names it in its own dependency list
  // because of that. The alternative — a ref holding the latest `loaded`, so this could memoise on
  // `[]` — is a ref written during render, which is the thing the React compiler's lint refuses;
  // and the stale-closure bug it papers over is real, not theoretical: with `[]` deps the mutators
  // captured the very first `setDraft`, whose fallback was the null of a registry that had not
  // loaded yet, so "add field" folded onto null and did nothing at all.
  // How many times the OWNER has changed the draft. Bumped by `setDraft` and by nothing else,
  // which is the whole point: `save()` reads it before its round trips and again after, and only
  // drops the local copy when the two agree. A save is 1+N awaited requests long, and dropping
  // the copy unconditionally at the end threw away everything typed while they were in flight —
  // silently, with the boxes still showing it until the next render read through to the cache.
  // Not part of `edits` itself: the id-fold below writes to `edits` and is emphatically not an
  // edit by the owner.
  const editSeq = useRef(0);

  const setDraft = useCallback(
    (next: (current: RegistryDraftState | null) => RegistryDraftState | null) => {
      editSeq.current += 1;
      setEdits((current) => next(current ?? loaded));
    },
    [loaded],
  );

  // Both sides are plain JSON — `values` and `config` are literally JSON columns — so a
  // structural compare is exact here, and it keeps this hook free of a hub-internal helper it
  // would have to shed if the builder ever ships from the registries site itself.
  const dirty =
    edits !== null && loaded !== null && JSON.stringify(edits) !== JSON.stringify(loaded);

  const saveBlock = draftBlock(draft);

  const save = useCallback(async () => {
    if (!draft || !registryId) return;
    // Fail before the first write, not between the third and the fourth. `canSave` already
    // refuses the press, so reaching this means something bypassed the bar — and a save that
    // half-applies is worse than one that does not start.
    const block = draftBlock(draft);
    if (block) {
      setWriteError(block);
      return;
    }
    const seqAtStart = editSeq.current;
    setSaving(true);
    setWriteError(null);
    try {
      // The section loop below only walks `draft.sections`, so a field whose `sectionId`
      // matches none of them would otherwise be skipped in total silence — never created,
      // never updated, never reported, with no visible sign anything went wrong. That can only
      // happen from a stale section reference surviving a concurrent edit elsewhere; make it a
      // loud, atomic failure (nothing in this save partially applies) rather than a quiet drop.
      const orphaned = draft.fields.filter((f) => !draft.sections.some((s) => s.id === f.sectionId));
      if (orphaned.length > 0) {
        throw new Error(
          `${orphaned.length} field${orphaned.length === 1 ? '' : 's'} could not be saved — ` +
          `${orphaned.length === 1 ? 'its section is' : 'their sections are'} missing from ` +
          'this registry. Reload and try again.',
        );
      }
      await client.updateRegistry(registryId, {
        name: draft.registry.name,
        purpose: draft.registry.purpose,
        description: draft.registry.description,
        categoryRoot: draft.registry.categoryRoot,
        entryTerm: draft.registry.entryTerm,
        visibility: draft.registry.visibility,
        submissionPolicy: draft.registry.submissionPolicy,
        servicesEnabled: draft.registry.servicesEnabled,
        // `slug` is absent on purpose and not an oversight: the server's update schema does not
        // accept it, because other people's bookmarks and other systems have already resolved
        // it. The Details pane renders it read-only for the same reason.
        tags: draft.registry.tags,
      });
      // Per section, not per field: `sortOrder` is a position within a section, so the index
      // that gets written has to come from the section's own run of peers, not the flat list.
      for (const section of draft.sections) {
        const peers = draft.fields.filter((f) => f.sectionId === section.id);
        for (const [index, field] of peers.entries()) {
          if (field.id) {
            // key, type and sectionId are omitted deliberately — see the client's comment
            // on updateFieldDef. No `...field` spread either: the server 400s a PATCH that
            // carries `type`, so an update body has to name its keys explicitly.
            await client.updateFieldDef(registryId, field.id, {
              label: field.label, help: field.help, required: field.required,
              visibility: field.visibility, config: field.config,
              sortOrder: index, showIf: field.showIf,
            });
          } else {
            const created = await client.createFieldDef(registryId, { ...field, sortOrder: index });
            // R4-I7. `reload()` runs only after the whole loop, so a create that succeeds and is
            // then followed by a failure used to leave the row in the draft still id-less: the
            // next Save re-CREATED it, and the owner got a duplicate-key 400 naming a field
            // they can see exactly one of. Folding the id in as it lands makes the retry an
            // update. Functional `setDraft` because the owner can be editing while the loop is
            // in flight; matched by `clientKey`, which is the only identity a row has before it
            // has an `id`. The loop keeps walking the render-time `draft`, so this cannot make
            // a row be visited twice.
            //
            // `setEdits`, NOT `setDraft`: `setDraft` folds onto `current ?? loaded`, and `loaded`
            // in this closure is the registry this save started on. Switch registries mid-save
            // and the render-phase reset nulls `edits`, so the next fold would write the OLD
            // registry's entire draft in as the NEW one's local copy — and Save would then PATCH
            // the registry on screen with the content of the one that is gone. A null `current`
            // means there is nothing left of this save to fold into, so the fold is skipped.
            setEdits((current) =>
              current === null
                ? current
                : {
                    ...current,
                    fields: current.fields.map((f) =>
                      f.clientKey === field.clientKey ? { ...f, id: created.id } : f,
                    ),
                  },
            );
          }
        }
      }
      await reload();
      // The edits ARE the server's content now, so the local copy comes out and the draft goes
      // back to reading through to the cache — which is also what makes `dirty` false again.
      // Unless the owner kept typing through the round trips, in which case what is in `edits`
      // is no longer what was just written and dropping it would delete work nothing had saved.
      // They stay dirty and press Save again, which is the honest outcome.
      if (editSeq.current === seqAtStart) setEdits(null);
      // The rail draws every row's label from the registry LIST's cache entry, so a rename that
      // refreshed only this item would leave the row the owner just renamed reading its old name.
      revalidateResources((key) => key === listCacheKey);
      // And the FORM is its own cached item, read by both editors that render the signup form
      // (`useRegistryForm`) — a different collection, so the sweep above cannot reach it. Without
      // this, a field the owner just added, renamed, reordered or deleted stayed invisible to the
      // registrant's form and to the roster's editor for the cache's full 30-minute life.
      revalidateResourceItems((key) => key === REGISTRY_FORM_CACHE_KEY);
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [client, draft, listCacheKey, registryId, reload]);

  // Returns whether the section was actually created, because the caller owns the "adding a
  // section" input and can only decide whether to clear it from that. The error itself is
  // still reported the same way every other failure here is — through `error`, on screen.
  const createSection = useCallback(async (label: string): Promise<boolean> => {
    if (!registryId || !label.trim()) return false;
    // The server gates a section's key with the same SLUG_RE as everything else, and the old
    // derivation here — lowercase, then every other character to a dash — satisfied neither end
    // of it: "AI" became a two-character key and "UX / Research" became "ux---research", both of
    // which came back as a bare 400 that named nothing. `slugify` produces the shape the regex
    // wants, and `keyProblem` says which rule a name still cannot satisfy — "AI" has no
    // three-character slug, and no amount of retrying the same word will find one.
    const key = slugify(label);
    const problem = keyProblem(key);
    if (problem) {
      setWriteError('That section name cannot be used as an address — ' + problem);
      return false;
    }
    setWriteError(null);
    try {
      await client.createSection(registryId, {
        label: label.trim(),
        key,
        description: '',
        sortOrder: draft?.sections.length ?? 0,
      });
      await reload();
      // Same as before this hook rode the cache: a section create re-reads the registry and the
      // form goes back to the server's shape, uncommitted field edits included. The write has
      // already reshaped what a field can belong to, so the reshaped form is the honest one.
      setEdits(null);
      return true;
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : String(e));
      return false;
    }
  }, [client, draft, listCacheKey, registryId, reload]);

  // Rejects instead of setting `error`, unlike every other write here. The two failure
  // surfaces are for two different readers: `error` renders in the editing frame the owner is
  // looking at, whereas a delete is confirmed in a dialog ON TOP of that frame, so a message
  // routed to `error` would land behind the dialog that is still open. `DeleteEntitySection`
  // renders a thrown rejection inline in its own confirm step, which is where the owner is.
  const deleteRegistry = useCallback(async () => {
    if (!registryId) return;
    await client.deleteRegistry(registryId);
    // Everything this registry owned is still in the cache, keyed by an id the server no longer
    // knows: its content, its form, its entry lists, and every registrant's own listing in it.
    // None of it expires for half an hour, so a bookmark or a Back press to a URL naming the
    // deleted registry painted the whole editor from the cache — the registry the owner had just
    // deleted, on screen, editable, as if the delete had not happened.
    revalidateResources(
      (key) => key === listCacheKey || key.startsWith(registryEntriesKey(registryId)),
    );
    // The item caches match on the COLLECTION, not the id — `revalidateResourceItems` is handed
    // the cache key and nothing else — so this marks every registry's content/form/listing stale
    // rather than only the dead one's. That is the wider sweep of the two available and it is the
    // safe direction: a stale mark costs one background re-read of a registry that is still there.
    revalidateResourceItems(
      (key) =>
        key === REGISTRY_CONTENT_CACHE_KEY ||
        key === REGISTRY_FORM_CACHE_KEY ||
        key === MY_ENTRY_CACHE_KEY,
    );
  }, [client, listCacheKey, registryId]);

  // The other half of the platform's standard editing bar, which pairs every Save with a
  // Cancel. `loaded` is the last thing the server actually returned, so reverting to it is
  // exactly "forget what I typed" — it does not undo a section create or a field delete,
  // which are writes that already happened and are already part of `loaded`.
  const revert = useCallback(() => {
    setEdits(null);
    setWriteError(null);
  }, []);

  // Awaited, not fire-and-forget: an unsaved field (no `id` yet) is only ever local state and
  // comes out immediately, but a saved one must survive the request before the row disappears
  // — a rejected delete (403, a stale registry) previously still removed the row on the spot,
  // silently, with `dirty` flipped true and the row reappearing on the next `reload()`.
  const deleteField = useCallback(async (field: FieldDraft) => {
    if (!field.id) {
      setDraft((current) =>
        current ? { ...current, fields: removeFieldAndClearDependents(current.fields, field) } : current,
      );
      return;
    }
    if (!registryId) return;
    setWriteError(null);
    try {
      await client.deleteFieldDef(registryId, field.id);
      // Clearing the dependents' rules is the SERVER's job — DELETE /field-defs/:id nulls every
      // `showIf` naming this field's key in the same transaction as the delete. This is only the
      // local mirror of what already happened, so the form matches without a reload. It used to
      // be a `Promise.all` of one PATCH per dependent, which could half-apply (a closed tab, a
      // 403) and reindexed the whole registry once per dependent.
      setDraft((current) =>
        current ? { ...current, fields: removeFieldAndClearDependents(current.fields, field) } : current,
      );
      // And re-read, because `revert`'s promise is "back to what the last load returned" and the
      // last load still contains the row that no longer exists. Without this, Cancel put the
      // deleted field back on screen — a row the owner had already destroyed, that the next Save
      // would try to PATCH by an id the server has forgotten. The mirror above is not redundant
      // with it: it is what keeps the row from flickering back for the length of the round trip.
      await reload();
    } catch (e) {
      setWriteError(e instanceof Error ? e.message : String(e));
    }
  }, [client, registryId, reload, setDraft]);

  const setRegistry = useCallback((patch: Partial<RegistryRow>) => {
    setDraft((current) =>
      current ? { ...current, registry: { ...current.registry, ...patch } } : current,
    );
  }, [setDraft]);

  const setField = useCallback((field: FieldDraft, next: FieldDefDraft) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            fields: current.fields.map((f) =>
              f === field ? { ...next, sectionId: field.sectionId, clientKey: field.clientKey } : f,
            ),
          }
        : current,
    );
  }, [setDraft]);

  const addField = useCallback((sectionId: string) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            fields: [
              ...current.fields,
              {
                sectionId, key: '', type: 'text', label: '', help: '',
                required: false, visibility: 'public', config: {},
                sortOrder: current.fields.filter((f) => f.sectionId === sectionId).length,
                showIf: null,
                clientKey: mintFieldKey(),
              },
            ],
          }
        : current,
    );
  }, [setDraft]);

  // Swaps `field` with its neighbour `delta` away, within its own section only — a field never
  // crosses into another section's order. `peers` is recomputed from the whole field list rather
  // than from whatever the caller happens to be rendering, so this stays correct for whichever
  // section `field` actually belongs to. Deliberately does NOT rewrite `sortOrder`: assigning
  // positions is the save's job, from where each row ends up sitting.
  const moveField = useCallback((field: FieldDraft, delta: number) => {
    setDraft((current) => {
      if (!current) return current;
      const peers = current.fields.filter((f) => f.sectionId === field.sectionId);
      const from = peers.indexOf(field);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= peers.length) return current;
      const reordered = [...peers];
      reordered.splice(to, 0, ...reordered.splice(from, 1));
      // Back into the slots the section's rows already occupied, rather than appended to the tail.
      // The tail version reordered the flat array for every OTHER section too, so moving one field
      // up in the first section left the draft structurally different from `loaded` in ways nobody
      // asked for: `dirty` stuck true after a move and its undo, and Save rewrote every section's
      // `sortOrder` to prove it had not changed. `sortOrder` is still the save's to assign — this
      // only decides which row sits where within its own section.
      const queue = [...reordered];
      return {
        ...current,
        // `?? f` is unreachable — `queue` holds exactly the rows this predicate matches — and is
        // here because `shift()` is typed as possibly-empty, not because it can run out.
        fields: current.fields.map((f) => (f.sectionId === field.sectionId ? queue.shift() ?? f : f)),
      };
    });
  }, [setDraft]);

  return {
    client, draft, error, saving, dirty, saveBlock,
    setRegistry, setField, addField, deleteField, moveField, createSection, deleteRegistry,
    revert, save,
  };
}
