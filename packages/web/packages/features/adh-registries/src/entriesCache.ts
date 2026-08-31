import { revalidateResources } from '@agentic-toolkit/data';
import type { EntryStatus } from '@agentic-toolkit/registry/client';

/**
 * Where one registry's entries live in the platform cache.
 *
 * Keyed per registry AND per status filter, because the two surfaces that list entries ask the
 * server two different questions: the roster (`Providers`) asks for every status, the review
 * queue (`Submissions`) asks for `pending` only. One key for both would serve whichever list
 * happened to read first to the other — a queue showing published listings, or a roster missing
 * everyone who is not pending.
 *
 * The unfiltered key is a PREFIX of every filtered one, which is what lets a writer invalidate
 * all of a registry's lists without enumerating the filters that exist.
 */
export function registryEntriesKey(registryId: string, status?: EntryStatus): string {
  return `registries/${registryId}/entries${status ? `?status=${status}` : ''}`;
}

/**
 * Re-read this registry's cached entry lists, other than `except`.
 *
 * A write to one entry is almost never about one list: approving a submission takes it off the
 * queue AND changes its badge on the roster, and removing a provider takes it off both. The list
 * the writer is standing in has usually already applied the change locally — that one is what
 * `except` names, so an optimistic update is not immediately overwritten by a round trip it does
 * not need.
 */
export function revalidateRegistryEntries(registryId: string, except?: string): void {
  const prefix = registryEntriesKey(registryId);
  revalidateResources((key) => key.startsWith(prefix) && key !== except);
}

/**
 * The collection a registrant's OWN listing is cached under, keyed by the registry it is in.
 *
 * Here rather than beside its reader, because it has two writers and only one of them is that
 * reader. `EntryEditorRoute` reads it and writes back what the registrant saved; the OWNER,
 * editing somebody else's listing from the roster, writes the same row through a different
 * component that has no reason to know where the registrant's copy lives — and while this key was
 * private to the route, it could not, so a listing the owner had just corrected stayed on the
 * registrant's own screen in its pre-edit shape for the cache's whole life.
 */
export const MY_ENTRY_CACHE_KEY = 'registry-my-entry';

/**
 * Where one entry's services live in the platform cache.
 *
 * Deliberately NOT under the entries prefix above, even though a service belongs to an entry: that
 * prefix is what `revalidateRegistryEntries` sweeps, and a decision on the review queue has no
 * business re-reading the services of every entry it touched.
 */
export function registryServicesKey(registryId: string, entryId: string): string {
  return `registry-services/${registryId}/${entryId}`;
}
