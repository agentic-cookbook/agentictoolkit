'use client';

import * as React from 'react';

import { useWorkspaceDefaultEcosystemId } from '@agentic-toolkit/data/ecosystems';
import { IntegrationsPane } from '@agentic-toolkit/integrations';
import { StandaloneRailHost } from '@agentic-toolkit/resource';
import { Button } from '@agenticdevelopertoolkit/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@agenticdevelopertoolkit/ui/components/dialog';
import { EmptyState } from '@agenticdevelopertoolkit/ui/components/empty-state';

import type { ShiprClient } from '../client';

/**
 * The forge credentials every run goes out over — {@link IntegrationsPane}, scoped to this
 * workspace's own infrastructure ecosystem.
 *
 * A DIALOG OF ITS OWN, and this is the whole reason the file exists. It was a pane inside
 * Configure, opened by a button on the repository list's bar, and in that shape the "Add
 * integration" button could not be drawn AT ALL — which is to say there was no way to
 * connect a GitHub account from this console.
 *
 * `IntegrationsPane` renders only a detail and publishes its list as a rail level, one
 * deeper than whatever is hosting it, and the "+" that adds an integration is that level's.
 * Inside Configure it was published under the repository list — a level that is NOT selected
 * while Connections is showing, because Connections is a sibling of a repository's settings
 * and not a repository. `HierarchicalDetailView` renders levels up to the first UNSELECTED
 * one and slices the rest (`levels.slice(0, frontier + 1)`), so the integrations level, and
 * with it the only add button in the feature, was cut off every single time.
 *
 * Nested one modal deeper it is the rail's FIRST level rather than an orphaned second, which
 * is the same position it holds on the Integrations site. Registering already opens a dialog
 * over this one, and the operator arrives here from that wizard as often as from the bar.
 */

/** The forges a deployment pipeline can actually reach. The whole catalog would offer an
 *  operator a Stripe key on a screen about pushing branches. */
const PROVIDERS = ['github-app', 'vercel', 'railway'] as const;

/**
 * THE ONE PIECE OF CONSOLE STATE THAT IS IN THE URL, and the reason is that this dialog is
 * the only place in the console an operator can LEAVE THE APP from and come back.
 *
 * Connecting a GitHub App sends the browser to github.com and the provider returns it to
 * `/integrations/oauth-callback`, which navigates on to `returnTo` — the full URL the connect
 * started on, captured by `currentReturnTo()`. Every other modal here is React state and can
 * be, because nothing ever unmounts the page under it. This one has to survive a document
 * that was thrown away and rebuilt, so the only carrier is the address bar.
 *
 * A hash rather than a query parameter: it is a position within this page, it never reaches
 * the server, and it cannot collide with `?workspace=`, which the console reads its tree
 * with and which must survive the round-trip unchanged.
 *
 * Written with `replaceState`, not `pushState`. Opening a dialog is not a navigation, and a
 * Back button that closed a dialog instead of leaving the console would be a worse lie than
 * a URL that is one step behind.
 */
export const CONNECTIONS_HASH = '#connections';

/** True when the current address names {@link CONNECTIONS_HASH}. Guarded for SSR: this file
 *  is `'use client'`, but a client component still renders once on the server. */
export function connectionsHashPresent(): boolean {
  return typeof window !== 'undefined' && window.location.hash === CONNECTIONS_HASH;
}

/** Put the address in agreement with whether Connections is showing, without adding history
 *  entries and without disturbing the path or the query. */
export function syncConnectionsHash(open: boolean): void {
  if (typeof window === 'undefined') return;
  const { pathname, search, hash } = window.location;
  if (open === (hash === CONNECTIONS_HASH)) return;
  const next = open ? `${pathname}${search}${CONNECTIONS_HASH}` : `${pathname}${search}`;
  window.history.replaceState(window.history.state, '', next);
}

export interface ConnectionsDialogProps {
  open: boolean;
  onClose: () => void;
  /** Read for its workspace slug, which is the same `?workspace=` the console reads its tree
   *  with. Nothing here calls it — the pane owns its own requests. */
  client: ShiprClient;
  /** A connection was added, removed or re-credentialed, so whoever holds a list of them
   *  should read it again. */
  onChanged?: () => void;
}

export function ConnectionsDialog({
  open,
  onClose,
  client,
  onChanged,
}: ConnectionsDialogProps): React.ReactElement {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex h-[80vh] max-w-5xl flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Connections</DialogTitle>
        </DialogHeader>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded border border-apt-border">
          {/* Mounted only while open, like Configure's own body: the ecosystem resolution is
              a request and the rail host is a registry, and a dialog stays mounted when it
              closes. */}
          {open ? <ConnectionsBody client={client} onChanged={onChanged} /> : null}
        </div>
        {/* ONE button, and it says Done rather than OK. Every write on this screen has already
            happened — the detail view owns its own Save, and removing an integration confirms
            itself — so there is nothing here for a Cancel to abandon, and offering one would
            promise an undo that does not exist. */}
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The resolution gate in front of the pane.
 *
 * `isPending` is what separates "still asking" from "asked, and there is no infrastructure
 * ecosystem": mounting the pane on the first would show an empty list that fills in
 * silently, and refusing on it would tell an operator there is nothing set up while the
 * answer was still in flight. The pane's own `ecosystemId` is optional and falls back to
 * `""` inside it, which reads to every route as "no such ecosystem" — so a falsy check
 * inside the pane cannot tell those two apart, and the gate belongs out here.
 *
 * The host is mounted only on the branch that has a pane to put in it. A rail host with no
 * levels is a rail with no columns.
 */
function ConnectionsBody({
  client,
  onChanged,
}: {
  client: ShiprClient;
  onChanged?: () => void;
}): React.ReactElement {
  const { ecosystemId, isPending, isError } = useWorkspaceDefaultEcosystemId(
    client.workspace,
  );

  if (isPending) return <Notice title="Loading…" />;
  if (isError) {
    return (
      <Notice
        title="Couldn't read this workspace's integrations."
        description="Forge credentials are stored against the workspace's infrastructure ecosystem, and this console could not look it up. Nothing is lost — try again, or open Integrations on the hub."
      />
    );
  }
  if (!ecosystemId) {
    return (
      <Notice
        title="This workspace has no infrastructure ecosystem."
        description="Forge credentials are stored against the workspace's infrastructure ecosystem. Until one exists there is nowhere to put them, and every run will fail to reach the forge."
      />
    );
  }
  return (
    <StandaloneRailHost>
      <IntegrationsPane
        ecosystemId={ecosystemId}
        providerIds={PROVIDERS}
        levelTitle="Connections"
        onChanged={onChanged}
      />
    </StandaloneRailHost>
  );
}

function Notice({
  title,
  description,
}: {
  title: string;
  description?: string;
}): React.ReactElement {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-6 py-4">
      <EmptyState title={title} description={description} />
    </div>
  );
}
