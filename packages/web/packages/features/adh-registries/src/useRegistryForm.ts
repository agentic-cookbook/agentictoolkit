'use client';

import { useCallback } from 'react';
import { useResourceItemQuery } from '@agentic-toolkit/data';
import type { FieldDefRow, RegistryClient, SectionRow } from '@agentic-toolkit/registry/client';

/**
 * Everything `EntryEditor` needs that belongs to the REGISTRY rather than to the entry — the
 * form's sections and field definitions, plus the four settings the editor reads off the
 * registry row.
 *
 * One cached item rather than three, because they are only ever useful together: the rail cannot
 * render a section it has no label for, and a staggered load would show a rail that grows under
 * whoever is reading it.
 */
export interface RegistryForm {
  sections: SectionRow[];
  fieldDefs: FieldDefRow[];
  entryTerm: string;
  categoryRoot: string;
  servicesEnabled: boolean;
  boundSiteId: string | null;
}

/**
 * The collection a registry's form is cached under.
 *
 * Exported because the form has a writer that is not this file: the owner's draft editor changes
 * the very sections and field defs `load` below reads, and they are a separate cached collection,
 * so the registry-LIST sweep that editor already runs cannot reach this one.
 */
export const REGISTRY_FORM_CACHE_KEY = 'registry-form';

/**
 * The registry's form, through the platform cache.
 *
 * Split out from the entry it describes on purpose, because two people now open the same form
 * from opposite sides: the registrant editing their own listing (`EntryEditorRoute`) and the
 * owner editing somebody else's from the roster (`RegistryProvidersPanel`). The ENTRY differs
 * between them; the form does not. Keeping it one cache entry means whichever of them arrives
 * second pays nothing for it, and — the reason that matters more — there is one description of
 * what the editor needs from a registry instead of a copy per caller to drift apart.
 */
export function useRegistryForm(
  registryId: string | null,
  client: RegistryClient,
): { form: RegistryForm | null; error: string | null } {
  const load = useCallback(
    async (id: string): Promise<RegistryForm> => {
      const [registry, sections, defs] = await Promise.all([
        client.getRegistry(id),
        client.listSections(id),
        client.listFieldDefs(id),
      ]);
      return {
        sections: sections.items,
        fieldDefs: defs.items,
        entryTerm: registry.entryTerm,
        categoryRoot: registry.categoryRoot,
        servicesEnabled: registry.servicesEnabled,
        boundSiteId: registry.boundSiteId,
      };
    },
    [client],
  );

  const { item, error } = useResourceItemQuery(REGISTRY_FORM_CACHE_KEY, registryId, load);
  return { form: item ?? null, error };
}
