'use client';

import { useCallback } from 'react';
import { useResourceItemQuery, useResourceItemWriter } from '@agentic-toolkit/data';
import type { EntryRow } from '@agentic-toolkit/registry/client';
import { useBasePathRoute } from '@agentic-toolkit/resource';
import { MY_ENTRY_CACHE_KEY, revalidateRegistryEntries } from './entriesCache';
import { EntryEditor } from './EntryEditor';
import { JOINED } from './paths';
import { useRegistryClient } from './useRegistryClient';
import { useRegistryForm } from './useRegistryForm';

export interface EntryEditorRouteProps {
  /** The feature's mount point — see `RegistriesFeatureProps.basePath`. Threaded down rather
   *  than re-derived, so the two arms of this feature cannot disagree about where they are. */
  basePath: string;
  registryId: string;
  /** The rail's open section, off the URL's third segment. Absent selects locally. */
  section?: string;
}

/**
 * Loads the caller's own entry — created as a draft on first visit — and its form.
 *
 * This is the SOLE production composition of `EntryEditor` for a registrant (the owner reaches
 * the same editor from the roster, through `RegistryProvidersPanel`), which is what made R4-C1
 * possible: the editor's Cancel and its deep-linkable rail are both opt-in props, both tests
 * passed them, and nothing shipped them. So a registrant's "Discard" discarded nothing and left
 * them sitting in the editor they had just asked to leave, with a prompt whose other button says
 * "Stay". Every optional prop the editor exposes is passed here now, for that reason — a
 * composition that covers part of a component's surface is the one shape tests of the component
 * cannot see.
 */
export function EntryEditorRoute({ basePath, registryId, section }: EntryEditorRouteProps) {
  const client = useRegistryClient();
  // The push semantics — scroll preservation, a null segment shortening the URL — are the
  // resource substrate's, so they are not restated here. This used to arrive through the
  // hub-local `useFeatureRoute('registries')`, which was the same call with the base path
  // computed from a segment only one host has.
  const { pushSegment, pushDeep } = useBasePathRoute(basePath);

  // `myEntry` is a POST and idempotent: it returns the caller's listing, creating the draft on
  // the first visit. Through the cache, so a registrant who steps out to another feature and
  // comes back is not made to wait on it again to see the form they were already filling in —
  // and so a slow read for a registry they have since navigated away from cannot paint over the
  // one in front of them, which is what the `live` flag this replaced was for.
  const loadMine = useCallback((id: string) => client.myEntry(id), [client]);
  const { item: entry, error: entryError } = useResourceItemQuery(
    MY_ENTRY_CACHE_KEY,
    registryId,
    loadMine,
  );
  const write = useResourceItemWriter<EntryRow>(MY_ENTRY_CACHE_KEY);

  // The registry half — sections, field defs, the four settings — is a SEPARATE cache entry
  // because it belongs to the registry rather than to this listing, and the owner's editor reads
  // exactly the same thing about exactly the same registry. Two queries, not one round trip
  // more: react-query runs them in parallel, and the editor still waits for both, so the rail
  // never grows under the registrant.
  const { form, error: formError } = useRegistryForm(registryId, client);

  // The row the server just wrote, put into the cache in place of the one this pane loaded, so
  // a return trip paints the saved listing rather than the pre-save copy.
  const onSaved = useCallback(
    (saved: EntryRow) => {
      write(registryId, saved);
      // The owner's roster and review queue both list this row, and neither can learn from
      // here that its content — or, on a resubmit, its status — has changed.
      revalidateRegistryEntries(registryId);
    },
    [registryId, write],
  );

  // Error second, and only while there is nothing to show: once the form is on screen a failed
  // background revalidation must not replace what the registrant is typing into with an alert.
  const error = entryError ?? formError;
  if (!entry || !form) return error ? <p role="alert">{error}</p> : <p>Loading your listing…</p>;
  return (
    <EntryEditor
      registryId={registryId}
      entry={entry}
      sections={form.sections}
      fieldDefs={form.fieldDefs}
      entryTerm={form.entryTerm}
      categoryRoot={form.categoryRoot}
      servicesEnabled={form.servicesEnabled}
      boundSiteId={form.boundSiteId}
      onSaved={onSaved}
      // Leaving, not clearing: the editor only calls this once the exit gate has let go, and
      // the gate's own prompt offers "Stay" as the alternative. Back to the registries list —
      // the screen the registrant arrived from, and the only other one this feature has for
      // them.
      onCancel={() => pushSegment(null)}
      activeSection={section}
      // `pushDeep` drops a null tail, so closing a section routes to `joined/<id>` rather than
      // to a trailing slash the parser would read as a fourth segment.
      onSectionChange={(id) => pushDeep(JOINED, registryId, id)}
    />
  );
}
