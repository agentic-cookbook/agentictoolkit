'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LibraryBig } from 'lucide-react';
import { useResourceList } from '@agentic-toolkit/data';
import { ResourceExplorer } from '@agentic-toolkit/resource';
import { GearMenuTrigger } from '@agenticdevelopertoolkit/ui/blocks';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@agenticdevelopertoolkit/ui/components/dropdown-menu';
import { CreateRegistryDialog } from './CreateRegistryDialog';
import { EntryEditorRoute } from './EntryEditorRoute';
import { registryTopics } from './registryTopics';
import { useRegistryClient } from './useRegistryClient';
import { useRegistryDraft } from './useRegistryDraft';
import type { RegistriesSelection } from './paths';

export interface RegistriesFeatureProps {
  /**
   * Where this feature is mounted — `/<workspace>/registries` on the hub, `/<workspace>` on
   * agenticdeveloperregistries.com, whose whole site IS this feature.
   *
   * A PROP rather than a hook that derives it, which is what this was until 2026-08-31: the
   * hub-local `useFeatureRoute('registries')` read `[workspace]` off `useParams` and appended a
   * literal segment. Both halves are host knowledge — one host has no `registries` segment at
   * all — so a feature that computes them can only ever be mounted by the host it was written
   * for. Every link this feature builds comes off this string, so it is required and there is
   * no default: a wrong base does not degrade, it publishes URLs that 404.
   */
  basePath: string;
  selection: RegistriesSelection;
}

/**
 * The registries feature, in the two shapes it actually has.
 *
 * The grammar that decides between them is `parseRegistriesPath`, called by the page before
 * this component — so this file switches over DATA rather than over segment counts, and the
 * URL rules are assertable without rendering anything (`paths.test.ts`).
 *
 * The two arms are genuinely different screens rather than two views of one: the explorer is
 * the OWNER's, over registries they built, and the entry editor is the REGISTRANT's, over
 * their own listing in someone else's. They share no state, so they are two components, and
 * the hooks each needs live inside the one that needs them.
 */
export function RegistriesFeature({ basePath, selection }: RegistriesFeatureProps) {
  if (selection.kind === 'joined') {
    return (
      <EntryEditorRoute
        basePath={basePath}
        registryId={selection.registryId}
        section={selection.section}
      />
    );
  }
  return <RegistryExplorer basePath={basePath} selection={selection} />;
}

/**
 * The owner's side: one `ResourceExplorer` over the workspace's registries, with the open
 * registry's Details / sections / review queue as its topics.
 *
 * This replaces a list component and a builder component that each drew their own navigator.
 * Everything a workspace route offers is one hierarchical topic-detail stack (the home-route
 * rule in `project-guidelines`' ui-development topic), and a registry's sections were the
 * third navigator down and the only one the URL could not name.
 */
function RegistryExplorer({
  basePath,
  selection,
}: {
  basePath: string;
  selection: Extract<RegistriesSelection, { kind: 'explorer' }>;
}) {
  const router = useRouter();
  const client = useRegistryClient();
  // `useRegistryClient` memoises on `[]`, so this is referentially stable across renders —
  // which `useResourceList` requires of `load`.
  const load = useCallback(() => client.listRegistries().then((res) => res.items), [client]);
  const { items, reload, error } = useResourceList(basePath, load);

  // ONE draft for the open registry, shared by every topic that edits it. Called
  // unconditionally with a possibly-undefined id: "nothing selected" is a state the explorer
  // has, and the hook handles it (and handles the id CHANGING, which the old route got by
  // remounting the builder under a `key`).
  const editor = useRegistryDraft(selection.activeId, basePath);

  return (
    <ResourceExplorer
      all={selection.all}
      activeId={selection.activeId}
      activeTopic={selection.activeTopic}
      basePath={basePath}
      items={items}
      getId={(r) => r.id}
      getLabel={(r) => r.name}
      nameSuffix="Registry"
      itemIcon={<LibraryBig size={16} aria-hidden />}
      topics={registryTopics({
        editor,
        registryId: selection.activeId,
        // A deleted registry's pane is a pane about a row that no longer exists, so the list
        // is re-fetched and the URL taken back to the explicitly-unselected state. `…/all`
        // rather than the bare base path, because the bare one lets the explorer resume its
        // last selection — which is the registry that was just deleted.
        onDeleted: () => {
          // Caught, not left floating: `reload` REJECTS when the re-fetch fails, and an
          // unhandled rejection out of a click handler is a console error in production and a
          // full-screen dev overlay in development — over a failure that is ALREADY on screen,
          // since the same query puts it in `error` and the rail renders it as `loadError`.
          void reload().catch(() => {});
          router.push(`${basePath}/all`);
        },
      })}
      newLabel="New registry…"
      // The create verb lives behind the rail's gear, not beside it as a standalone `+`.
      // `renderNewControl` hands us only the trigger, so the explorer keeps owning the dialog
      // and the reload-then-route it does once the registry exists.
      renderNewControl={(onNew) => (
        <DropdownMenu>
          <GearMenuTrigger label="Registry actions" />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onNew}>New registry…</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      reload={reload}
      rail={{
        title: 'Registries',
        help: 'Pick a registry to shape the form people fill in, and to review what they submit.',
        // A failed list leaves `items` null forever (`useResourceList` sets the error and never
        // fills the array), so without this the rail would sit on "Loading…" and the error
        // would be invisible — the rail is the only surface that can show it.
        loadError: error,
        emptyLabel: 'You have not built a registry yet.',
      }}
      renderDialog={(onClose, onCreated) => (
        <CreateRegistryDialog onClose={onClose} onCreated={(made) => onCreated(made.id)} />
      )}
    />
  );
}
