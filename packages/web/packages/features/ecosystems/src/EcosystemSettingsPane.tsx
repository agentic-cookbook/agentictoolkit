"use client";

import type { ReactElement, ReactNode } from "react";

import { ecosystemsApi, type Ecosystem, type EcosystemInput } from "@agentic-toolkit/data/ecosystems";
import { useMasterDetailForm, RecordSettingsPane, useRecordAffordance } from "@agentic-toolkit/resource";
import { DeleteEntitySection } from "@agentic-toolkit/ui/blocks/delete-entity-section";
import {
  EcosystemDetail,
  ecoBlank,
  ecoToInput,
  ecoValidate,
  ecoDiffers,
  ecoNormalize,
} from "./EcosystemDetail";

/** Prefix `word` with its indefinite article (same one-line rule as EcosystemsFeature's —
 *  kept local; importing it back from there would cycle). */
const an = (word: string): string => (/^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`);

/** Settings editor for the active ecosystem (identifier, name, region, domain). */
export function EcosystemSettingsPane({
  noun = "Ecosystem",
  ecosystemId,
  items,
  refresh,
  loadError,
  title,
  help,
  onDelete,
  onRenamed,
}: {
  /** The presented entity noun (capitalized) — see EcosystemsFeature's `labels` prop. */
  noun?: string;
  ecosystemId?: string;
  /** The ecosystems list, owned by the parent feature (shared with the selector). */
  items: Ecosystem[] | null;
  /** Re-read the list after a mutation (the parent feature's reload). */
  refresh: () => void | Promise<void>;
  loadError?: string | null;
  title?: ReactNode;
  help?: ReactNode;
  /** Delete the active ecosystem (and navigate away). Renders the Danger section. */
  onDelete?: () => Promise<void>;
  /** Called after a successful identifier rename with the new rdid, so the parent
   *  can refresh the selector list and navigate to the new id. */
  onRenamed?: (newId: string) => void | Promise<void>;
}): ReactElement {
  // The host-injected per-record affordance (the hub's api-explorer button); null on
  // a standalone feature site → the trailing slot renders nothing.
  const renderRecordAffordance = useRecordAffordance();

  const form = useMasterDetailForm<Ecosystem, EcosystemInput>({
    items,
    getId: (e) => e.id,
    blank: ecoBlank,
    toInput: ecoToInput,
    validate: (draft, others) => ecoValidate(draft, others.map((o) => o.identifier)),
    differs: ecoDiffers,
    normalize: ecoNormalize,
    create: (input) => ecosystemsApi.create(input),
    update: async (id, input) => {
      const updated = await ecosystemsApi.update(id, input);
      if (updated.id !== id) await onRenamed?.(updated.id);
      return updated;
    },
    // Delete is owned by the Danger-zone DeleteEntitySection (onDelete), not the hook.
    refresh,
    createLabel: `New ${noun.toLowerCase()}`,
  });

  const active = items?.find((e) => e.id === ecosystemId);

  return (
    <RecordSettingsPane
      form={form}
      activeId={ecosystemId}
      items={items}
      getId={(e) => e.id}
      title={title}
      help={help}
      trailing={renderRecordAffordance?.({
        path: "/ecosystem/ecosystems/{id}",
        pathValues: { id: ecosystemId },
        title: `${noun} API`,
      })}
      loadError={loadError}
      emptyLabel={
        items === null
          ? "Loading…"
          : `Select ${an(noun.toLowerCase())} in the sidebar, or create a new one.`
      }
      renderDetail={(draft) => (
        <div className="flex flex-col gap-6">
          <EcosystemDetail
            key={form.detailKey}
            draft={draft}
            onChange={form.onChange}
            error={form.error}
            // The rdid is mutable — editable whether creating or editing; on save
            // a changed identifier is renamed via registry.identifiers (see api).
            identifierLocked={false}
          />
          {!form.creating && active && onDelete && (
            <DeleteEntitySection
              entityNoun={noun}
              confirmValue={active.identifier}
              childEntities="applications, buckets, and users"
              onConfirm={onDelete}
            />
          )}
        </div>
      )}
    />
  );
}
