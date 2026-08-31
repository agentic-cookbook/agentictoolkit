'use client';

import { Compass, IdCard, ListChecks, Rows3, Tag } from 'lucide-react';
import type { GroupTopicItem } from '@agentic-toolkit/resource';
import type { PublishBlocker } from '@agentic-toolkit/registry/types';
import type {
  EntryRow,
  FieldDefRow,
  FieldVisibility,
  RegistryClient,
  SectionRow,
} from '@agentic-toolkit/registry/client';
import { EntryIdentityPanel } from './EntryIdentityPanel';
import { EntryPublishPanel } from './EntryPublishPanel';
import { EntryReachPanel } from './EntryReachPanel';
import { EntrySectionPanel } from './EntrySectionPanel';
import { EntryServicesPanel } from './EntryServicesPanel';

export interface EntryTopicContext {
  draft: EntryRow;
  set: <K extends keyof EntryRow>(key: K, value: EntryRow[K]) => void;
  /** The owner's sections, in any order — this function sorts them. */
  sections: SectionRow[];
  /** The field defs whose `show_if` rule currently applies, already sorted. */
  live: FieldDefRow[];
  values: Record<string, unknown>;
  errors: Record<string, string>;
  blockers: PublishBlocker[];
  /** Which spine topic holds the thing stopping Save, if it is a spine topic at all. */
  blockedTopicId: string | null;
  /** The registry's category root, for the category hint. Prose only. */
  categoryRoot: string;
  entryTerm: string;
  onFieldChange: (key: string, value: unknown) => void;
  onFieldVisibilityChange: (key: string, visibility: FieldVisibility) => void;
  /** The client the services topic saves through — services are not part of the entry draft. */
  client: RegistryClient;
  registryId: string;
  /** From the registry. When false the services topic is not built at all. */
  servicesEnabled: boolean;
  onServicesDirtyChange: (dirty: boolean) => void;
}

/**
 * The one declaration of what a registry listing is made of.
 *
 * Two spine topics bracket the owner's own sections — spec §13's "spine sections first,
 * owner-defined sections after". Publishing goes LAST rather than beside identity because
 * its checklist means nothing until there are answers to check.
 *
 * A pure function of ONE context object, for the reason `projectTopics` is: the rail's
 * order, its blocked dots and every panel's props then have exactly one definition, and all
 * three are assertable without rendering a rail.
 */
export function entryTopics(ctx: EntryTopicContext): GroupTopicItem[] {
  // A blocker only ever names a def that passed the same `show_if` filter `live` did, so
  // this map covers every key that can appear in `ctx.blockers`.
  const sectionOf = new Map(ctx.live.map((def) => [def.key, def.sectionId]));

  return [
    {
      id: 'identity',
      label: 'Your listing',
      icon: <IdCard size={16} aria-hidden />,
      description: 'Name, address and summary.',
      blocked: ctx.blockedTopicId === 'identity',
      render: () => (
        <EntryIdentityPanel
          draft={ctx.draft}
          set={ctx.set}
          entryId={ctx.draft.id}
          entryTerm={ctx.entryTerm}
        />
      ),
    },
    {
      id: 'reach',
      label: 'How you are found',
      icon: <Compass size={16} aria-hidden />,
      description: 'Category, keywords, where you are, how you work.',
      // Dotted by `saveBlock`'s country-code and link clauses — the only two spine-topic
      // blocks that are not identity's or publishing's. `required` still never applies here:
      // that's a field-def property, and the spine has no field defs.
      blocked: ctx.blockedTopicId === 'reach',
      render: () => (
        <EntryReachPanel draft={ctx.draft} set={ctx.set} categoryRoot={ctx.categoryRoot} />
      ),
    },
    ...[...ctx.sections]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((section) => ({
        id: `section-${section.id}`,
        // The key is the fallback because a nameless rail row is unclickable in practice —
        // the registrant cannot tell what it is.
        label: section.label || section.key,
        icon: <Rows3 size={16} aria-hidden />,
        description: section.description || undefined,
        // Two different reasons, one dot. The owner marked a field in here required and it is
        // still blank (`blockers`, which gates PUBLISH), or an answer in here failed
        // validation and is holding up the SAVE (`errors`). The dot is how a registrant finds
        // either without opening every section in turn — and for `errors` it is R4-C2's second
        // half: before this, a bad value in a closed section made Save do nothing at all, with
        // no mark anywhere on screen pointing at the section holding it.
        blocked:
          ctx.blockers.some((blocker) => sectionOf.get(blocker.key) === section.id)
          || Object.keys(ctx.errors).some((key) => sectionOf.get(key) === section.id),
        render: () => (
          <EntrySectionPanel
            section={section}
            defs={ctx.live.filter((def) => def.sectionId === section.id)}
            values={ctx.values}
            valueVisibility={ctx.draft.valueVisibility}
            errors={ctx.errors}
            onChange={ctx.onFieldChange}
            onVisibilityChange={ctx.onFieldVisibilityChange}
          />
        ),
      })),
    ...(ctx.servicesEnabled
      ? [
          {
            id: 'services',
            label: 'Services',
            icon: <Tag size={16} aria-hidden />,
            description: 'What you offer, and what it costs.',
            render: () => (
              <EntryServicesPanel
                client={ctx.client}
                registryId={ctx.registryId}
                entryId={ctx.draft.id}
                onDirtyChange={ctx.onServicesDirtyChange}
              />
            ),
          },
        ]
      : []),
    {
      id: 'publishing',
      label: 'Publishing',
      icon: <ListChecks size={16} aria-hidden />,
      description: 'Who can see this, and what is still missing.',
      blocked: ctx.blockedTopicId === 'publishing',
      render: () => (
        <EntryPublishPanel draft={ctx.draft} set={ctx.set} blockers={ctx.blockers} />
      ),
    },
  ];
}
