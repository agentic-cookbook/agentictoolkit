'use client';

import { useCallback, useMemo, useState } from 'react';
import { StackGroupDetail, useRailExitGuard } from '@agentic-toolkit/resource';
import { ButtonBar } from '@agenticdevelopertoolkit/ui/blocks';
import { ErrorText } from '@agenticdevelopertoolkit/ui/components/error-text';
import { UnsavedChangesAlert } from '@agenticdevelopertoolkit/ui/components/unsaved-changes-alert';
import { useDirtyDraft } from '@agenticdevelopertoolkit/ui/hooks/useDirtyDraft';
import { useExitGate, type PaneExitGuard } from '@agenticdevelopertoolkit/ui/hooks/useExitGate';
import { SITES, isReservedSlug, type SiteId } from '@agentic-toolkit/adh-registry';
import {
  coerceFieldValue,
  evaluateShowIf,
  publishBlockers,
  validateFieldValue,
  type PublishBlocker,
} from '@agentic-toolkit/registry/types';
import type {
  EntryRow,
  FieldDefRow,
  FieldVisibility,
  RegistryClient,
  SectionRow,
} from '@agentic-toolkit/registry/client';
import { entryTopics } from './entryTopics';
import { linkProblem, normalizeLinks } from './links';
import { ENTRY_LIMITS, slugProblem } from './slug';
import { useRegistryClient } from './useRegistryClient';

export interface SaveBlock {
  message: string;
  topicId: string;
}

/**
 * `boundSiteId` narrowed to a site the catalog actually names, or `null`.
 *
 * Mirrors `knownSiteId` in `backend/src/adh/src/lib/registry-slug.ts` deliberately, because the
 * two halves have to refuse the same slugs: `bound_site_id` is a platform-admin free-form
 * varchar with no route that sets it, so the server skips the reserved check entirely for a
 * value the catalog has never heard of rather than failing closed and refusing every slug in a
 * newly bound registry. A client that flagged a slug the server would accept is a new defect,
 * not a guard — the registrant would be told to pick another address for no reason, with no
 * screen anywhere to appeal to.
 *
 * Narrowing rather than casting, for the same reason. `isReservedSlug(boundSiteId as SiteId, …)`
 * compiles and returns `false` for an unknown id today, so it would even behave correctly — but
 * it asserts membership nobody checked, and the day that function starts throwing or defaulting
 * on an unknown site, the cast is what turns that into a hub-side incident.
 */
function knownSiteId(id: string): SiteId | null {
  return SITES.some((site) => site.id === id) ? (id as SiteId) : null;
}

/**
 * The banner for a save that field validation refused.
 *
 * R4-C2: `errors` used to be set and nothing else — no message, no banner, no rail dot — so a
 * value that fails validation in a section the registrant is not looking at made Save do
 * nothing whatsoever, indefinitely. Naming the sections is the whole point: they are looking at
 * a section where everything is fine.
 *
 * A def whose key has no section (impossible while `defs` is `live`, which is derived from the
 * same field defs the sections were built from) contributes to the count and not to the names,
 * so the banner degrades to "1 answer needs fixing." rather than to nothing at all.
 */
export function fieldErrorMessage(
  errorKeys: readonly string[],
  defs: readonly FieldDefRow[],
  sections: readonly SectionRow[],
): string {
  const labelOf = new Map(sections.map((section) => [section.id, section.label || section.key]));
  const names: string[] = [];
  for (const key of errorKeys) {
    const label = labelOf.get(defs.find((def) => def.key === key)?.sectionId ?? '');
    if (label && !names.includes(label)) names.push(label);
  }
  const n = errorKeys.length;
  const count = `${n} ${n === 1 ? 'answer needs' : 'answers need'} fixing`;
  return names.length === 0 ? `${count}.` : `${count} — see ${names.join(' and ')}.`;
}

/**
 * Why this tag set cannot be saved, or `null`.
 *
 * The same class as the slug and for the same reason, but it cannot be a `maxLength`:
 * `TagSetField` takes neither a per-item length nor a cap on the set's size, so the bound has
 * to be stated at save instead of at the keystroke. The server's `entryWrite` bounds both
 * (`keywords: z.array(z.string().max(64)).max(32)`), and exceeding either 400s the whole save
 * with every other section's answers in it.
 */
function tagSetProblem(
  values: readonly string[],
  noun: string,
  maxItem: number,
  maxCount: number,
): string | null {
  if (values.length > maxCount) return `You can have at most ${maxCount} ${noun}s.`;
  const overlong = values.find((value) => value.length > maxItem);
  return overlong === undefined
    ? null
    : `“${overlong.slice(0, 20)}…” is too long — a ${noun} is at most ${maxItem} characters.`;
}

/**
 * Why Save is disabled, and which topic to look in. `null` means Save may run.
 *
 * Exported and pure for the same reason `entryTopics` is. This is the rule a registrant runs
 * into most often, and a disabled button on its own says only that something is wrong — never
 * what, and never where.
 *
 * `required` is deliberately absent from the first two clauses: it gates PUBLISH, not save
 * (the server's `assertPublishable` is the matching half), which is exactly what makes §13's
 * "independently saveable sections" possible. A registrant fills in one section, saves, and
 * comes back tomorrow for the rest.
 *
 * The country-code clause is the same defect class `normalizeLinks` exists for: the server's
 * `entryWrite.countryCode` is `z.string().length(2).or(z.literal(''))`, so a stray one-letter
 * code 400s the whole save — every other section's answers with it — same as an empty link
 * URL. Unlike a link, this value is never silently rewritten: a code the registrant typed and
 * a code the app invented would be indistinguishable, and the registrant asked for neither.
 */
export function saveBlock(
  draft: Pick<
    EntryRow,
    'slug' | 'displayName' | 'status' | 'countryCode' | 'links' | 'keywords' | 'languages'
  >,
  blockers: readonly PublishBlocker[],
  /** The registry's bound site, or `null`. Only a bound registry's slugs can collide. */
  boundSiteId: string | null,
): SaveBlock | null {
  if (!draft.displayName.trim()) {
    return { message: 'Your listing needs a name.', topicId: 'identity' };
  }
  const slug = draft.slug.trim();
  if (!slug) {
    return { message: 'Your listing needs an address.', topicId: 'identity' };
  }
  // R4-I1. `SLUG_RE` is a regex on the server and a 400 with no field name attached, which
  // rejects every OTHER section's answers in the same save. Said here instead, at the field.
  const shape = slugProblem(slug);
  if (shape) return { message: shape, topicId: 'identity' };
  const siteId = knownSiteId(boundSiteId ?? '');
  if (siteId && isReservedSlug(siteId, slug)) {
    // §5's second level. Unbound, this slug is a second path segment and collides with
    // nothing; bound, it is a top-level route on a real site, and the page wins.
    return {
      message: `“${slug}” is already a page on that site — choose another address.`,
      topicId: 'identity',
    };
  }
  if (draft.countryCode !== '' && draft.countryCode.length !== ENTRY_LIMITS.countryCode) {
    return { message: 'A country code is two letters — US, GB, DE.', topicId: 'reach' };
  }
  const keywords = tagSetProblem(
    draft.keywords, 'keyword', ENTRY_LIMITS.keyword, ENTRY_LIMITS.keywordCount,
  );
  if (keywords) return { message: keywords, topicId: 'reach' };
  const languages = tagSetProblem(
    draft.languages, 'language', ENTRY_LIMITS.language, ENTRY_LIMITS.languageCount,
  );
  if (languages) return { message: languages, topicId: 'reach' };
  if (draft.links.length > ENTRY_LIMITS.linkCount) {
    return { message: `You can have at most ${ENTRY_LIMITS.linkCount} links.`, topicId: 'reach' };
  }
  for (const link of draft.links) {
    const problem = linkProblem(link);
    if (problem) return { message: problem, topicId: 'reach' };
  }
  if (draft.status === 'published' && blockers.length > 0) {
    const n = blockers.length;
    return {
      message: `Publishing needs ${n} more ${n === 1 ? 'answer' : 'answers'}.`,
      topicId: 'publishing',
    };
  }
  return null;
}

export interface EntryEditorProps {
  registryId: string;
  entry: EntryRow;
  sections: SectionRow[];
  fieldDefs: FieldDefRow[];
  /** The registry's word for a listing. Only ever appears in prose, hence the safe default. */
  entryTerm?: string;
  /** The registry's category root, for the reach topic's hint. */
  categoryRoot?: string;
  client?: RegistryClient;
  onCancel?: () => void;
  onSaved?: (entry: EntryRow) => void;
  /** Deep-linkable section, the seam `PersonaEditor` uses. Omit for local selection. */
  activeSection?: string;
  onSectionChange?: (id: string | null) => void;
  /** From the registry. Decides whether the services topic exists at all. */
  servicesEnabled?: boolean;
  /** The registry's bound site id, or `null`. Decides whether the slug can collide. */
  boundSiteId?: string | null;
}

export function EntryEditor({
  registryId,
  entry,
  sections,
  fieldDefs,
  entryTerm = 'listing',
  categoryRoot = '',
  client: injected,
  onCancel,
  onSaved,
  activeSection,
  onSectionChange,
  servicesEnabled = false,
  boundSiteId = null,
}: EntryEditorProps) {
  const hookClient = useRegistryClient();
  const client = injected ?? hookClient;

  const { draft, set, dirty, commit } = useDirtyDraft<EntryRow>(() => entry);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Services save themselves, so `useDirtyDraft` cannot see them. Without this the rail lets
  // a typed-but-unsaved service walk away without the alert everything else gets.
  const [servicesDirty, setServicesDirty] = useState(false);

  const ordered = useMemo(
    () => [...fieldDefs].sort((a, b) => a.sortOrder - b.sortOrder),
    [fieldDefs],
  );

  /** The defs whose rule currently admits them. What renders, what validates and what gets
   *  sent all read THIS, so the three can never disagree about which fields are in play. */
  const live = useMemo(
    () => ordered.filter((def) => evaluateShowIf(def, draft.values)),
    [ordered, draft.values],
  );

  // `publishBlockers` applies the same `show_if` and soft-delete filters itself, so it is
  // handed the full list — the predicate stays defined in exactly one place.
  const blockers = useMemo(() => publishBlockers(ordered, draft.values), [ordered, draft.values]);
  const block = useMemo(
    () => saveBlock(draft, blockers, boundSiteId),
    [draft, blockers, boundSiteId],
  );

  const onFieldChange = useCallback(
    (key: string, value: unknown) => {
      set('values', { ...draft.values, [key]: value });
    },
    [draft.values, set],
  );

  // The registrant's own audience choice for one field. Stored beside the answer rather than
  // in it, because the two are edited and merged independently: clearing an answer must not
  // reopen the field to the world, and narrowing the audience must not touch what it says.
  const onFieldVisibilityChange = useCallback(
    (key: string, visibility: FieldVisibility) => {
      set('valueVisibility', { ...draft.valueVisibility, [key]: visibility });
    },
    [draft.valueVisibility, set],
  );

  const save = useCallback(async () => {
    // Validate against the same catalog the server uses — the package is shared exactly so a
    // value the browser accepts is a value the server accepts. `required: false` is forced
    // here for the same reason the server forces it: a blank answer is a legal draft.
    const nextErrors: Record<string, string> = {};
    const values: Record<string, unknown> = {};
    for (const def of live) {
      const raw = draft.values[def.key];
      if (raw === undefined) continue;
      const message = validateFieldValue({ ...def, required: false }, raw);
      if (message) nextErrors[def.key] = message;
      else values[def.key] = coerceFieldValue(def, raw);
    }
    setErrors(nextErrors);
    const failedKeys = Object.keys(nextErrors);
    if (failedKeys.length > 0) {
      // R4-C2's first half. The rail's dots are the second, in `entryTopics`: between them a
      // registrant looking at a section that is fine is told both that the save was refused
      // and where to go. Neither is enough alone — a banner without dots names a section but
      // not a field, and dots without a banner mark a rail nobody is looking at after
      // pressing a button that appeared to do nothing.
      setError(fieldErrorMessage(failedKeys, live, sections));
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const saved = await client.updateEntry(registryId, draft.id, {
        slug: draft.slug,
        displayName: draft.displayName,
        summary: draft.summary,
        photoAttachmentId: draft.photoAttachmentId,
        providerType: draft.providerType,
        category: draft.category,
        keywords: draft.keywords,
        locationText: draft.locationText,
        countryCode: draft.countryCode,
        regionCode: draft.regionCode,
        // `geo` belongs here and is deliberately absent: spec §4 sets it only when the
        // registrant opts into map or distance display, and there is no map in this editor —
        // two number boxes would produce a precise-looking value nobody verified, so the
        // column keeps its `null` permanently. (R4 `:1104`: this used to sit below the call,
        // where a reader looking for the omission it explains cannot find it.)
        areaServed: draft.areaServed,
        deliveryMode: draft.deliveryMode,
        links: normalizeLinks(draft.links),
        contactMode: draft.contactMode,
        languages: draft.languages,
        status: draft.status,
        visibility: draft.visibility,
        // Every LIVE field's value, every save, whichever section is open.
        //
        // R4-I8: this used to say the server REPLACES `values`, and that is false — it
        // merge-patches (`mergePatch` in `backend/src/adh/src/routes/registryEntries.ts`:
        // a top-level key absent here is left untouched, present replaces it whole, `null`
        // deletes it). So sending the whole map is NOT what protects the other sections'
        // answers; the merge is, and it is what makes §13's independently-saveable sections
        // work at all.
        //
        // What sending it whole buys is that the row ends up matching the editor the
        // registrant is looking at, without this component having to model which keys its
        // own edits could have reached. The omission that IS load-bearing is `live` rather
        // than `ordered`: a field whose `show_if` no longer admits it is absent from this map
        // on purpose, and the merge therefore leaves the answer it already had alone. Under
        // the replacing server the old comment described, that same line would erase it.
        values,
        // Sent WHOLE, and not filtered to `live` the way `values` is — the two maps are built
        // differently. `values` is rebuilt here from the live defs, so a key omitted from it
        // is a key this save deliberately declines to touch; `valueVisibility` is the stored
        // map with the registrant's edits merged into it, so every key it holds is one the
        // server already has. Filtering it would drop a hidden field's audience choice on the
        // floor for no gain, and the merge patch offers no way to say "keep" per key.
        valueVisibility: draft.valueVisibility,
      });
      // BEFORE `onSaved`, which is what navigates. §13's trap: an editor still dirty at this
      // moment makes its own exit guard veto the navigation its own save started — the URL
      // stays put, and a later reload 404s on a record that did save.
      commit(saved);
      onSaved?.(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [client, commit, draft, live, onSaved, registryId, sections]);

  const exitGuard = useMemo<PaneExitGuard | null>(
    () => (dirty || servicesDirty ? { isDirty: () => dirty || servicesDirty } : null),
    [dirty, servicesDirty],
  );
  useRailExitGuard(exitGuard);
  const { attemptExit, exitAlertProps } = useExitGate(exitGuard);

  const topics = entryTopics({
    draft,
    set,
    sections,
    live,
    values: draft.values,
    errors,
    blockers,
    blockedTopicId: block?.topicId ?? null,
    categoryRoot,
    entryTerm,
    onFieldChange,
    onFieldVisibilityChange,
    client,
    registryId,
    servicesEnabled,
    onServicesDirtyChange: setServicesDirty,
  });

  const leafHeader = (
    <>
      <ButtonBar
        actions={{
          onCreate: () => {},
          onCancel: () => attemptExit(() => onCancel?.()),
          canCancel: true,
          onSave: () => void save(),
          canSave: dirty && block === null,
          saving,
        }}
        showCreate={false}
        showDelete={false}
        // Only once there are edits to save: on an untouched listing "needs a name" reads as
        // a complaint about a form the registrant has not filled in yet.
        leading={
          block && dirty ? (
            <span className="text-xs text-apt-text-muted" role="status">
              {block.message}
            </span>
          ) : undefined
        }
      />
      <ErrorText error={error} className="px-6 pt-2" />
    </>
  );

  return (
    <>
      <StackGroupDetail
        levelId="registry-entry-topics"
        title={draft.displayName || 'Your listing'}
        items={topics}
        leafHeader={leafHeader}
        emptyHint="Pick a section to fill in."
        urlSelection={
          onSectionChange
            ? { selectedId: activeSection ?? null, onSelect: onSectionChange }
            : undefined
        }
      />
      {/* The platform's one prompt, for the Cancel gate above. StackGroupDetail publishes a
          rail LEVEL rather than wrapping a subtree, so this is a SIBLING, never a child. */}
      <UnsavedChangesAlert {...exitAlertProps} />
    </>
  );
}
