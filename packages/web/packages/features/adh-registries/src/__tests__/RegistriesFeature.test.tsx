// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';

// This repo's vitest config runs without `test.globals`, so @testing-library/react's own
// automatic afterEach cleanup (which only registers when it finds a GLOBAL `afterEach`) never
// fires — every component test file in this repo wires cleanup explicitly for the same reason
// (see WorkspaceTransferPane.test.tsx). Without it, several `render()` calls in one file pile
// up in `document.body` and a query that should match one node matches two.
afterEach(cleanup);

// `vi.mock` factories run before every top-level declaration in this file, so anything they
// share with the tests goes through `vi.hoisted` rather than a plain const.
const h = vi.hoisted(() => ({
  /** The ids the route hands the explorer's `onCreated` — see the create test below. */
  created: [] as string[],
  list: { items: [] as unknown[], reload: async () => {}, error: null as Error | null },
  createRegistry: vi.fn(),
}));

beforeEach(() => {
  h.created.length = 0;
  h.list.error = null;
  h.createRegistry.mockReset();
  h.createRegistry.mockResolvedValue({ id: 'r_new', name: 'Coaches' });
});

// The explorer reaches for the router even though nothing here navigates. `useParams` is no
// longer read by the feature — the base path is a PROP now, passed below — but the stub keeps
// it, because a component under the explorer that starts reading it should not fail on a
// missing mock in a suite that is not about routing.
vi.mock('next/navigation', () => ({
  useParams: () => ({ workspace: 'acme' }),
  useRouter: () => ({ push: () => {} }),
}));

vi.mock('../EntryEditorRoute', () => ({
  EntryEditorRoute: ({ registryId, section }: { registryId: string; section?: string }) => (
    <div data-testid="entry" data-registry={registryId} data-section={section ?? ''} />
  ),
}));

// Partial mock: `CreateRegistryDialog` imports `CreateResourceDialog` from this same module, so
// replacing the whole thing would take the dialog out with the navigator.
//
// The stub stands in for the explorer's OWN decisions (which rail row is current, when the
// create dialog is open) while still calling every render prop the route supplies — the route's
// half of the contract is what it hands over, and a stub that renders none of it would leave
// the rail's wording, the create affordance and the created-id handoff untested.
vi.mock('@agentic-toolkit/resource', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@agentic-toolkit/resource')>();
  const { useState } = await import('react');
  return {
    ...actual,
    ResourceExplorer: (props: Record<string, unknown>) => {
      const [newOpen, setNewOpen] = useState(false);
      const rail = props.rail as { emptyLabel?: string; loadError?: Error | null } | undefined;
      const renderNewControl = props.renderNewControl as
        | ((onNew: () => void) => ReactNode)
        | undefined;
      const renderDialog = props.renderDialog as
        | ((onClose: () => void, onCreated: (id: string) => void) => ReactNode)
        | undefined;
      return (
        <div
          data-testid="explorer"
          data-base={String(props.basePath)}
          data-all={String(props.all ?? '')}
          data-active={String(props.activeId ?? '')}
          data-topic={String(props.activeTopic ?? '')}
        >
          <span data-testid="rail-empty">{rail?.emptyLabel ?? ''}</span>
          <span data-testid="rail-error">{rail?.loadError?.message ?? ''}</span>
          {renderNewControl?.(() => setNewOpen(true))}
          {newOpen ? renderDialog?.(() => setNewOpen(false), (id) => h.created.push(id)) : null}
        </div>
      );
    },
  };
});

// The explorer is stubbed, so nothing below it renders — but the route still CALLS these, and
// the real ones would reach for a client and a network. Each is exercised by its own suite;
// what is under test here is which of the two screens a selection picks.
vi.mock('../registryTopics', () => ({ registryTopics: () => [] }));
vi.mock('../useRegistryDraft', () => ({ useRegistryDraft: () => ({}) }));
vi.mock('../useRegistryClient', () => ({
  useRegistryClient: () => ({
    listRegistries: async () => ({ items: [] }),
    createRegistry: h.createRegistry,
  }),
}));
vi.mock('@agentic-toolkit/data', () => ({ useResourceList: () => h.list }));

import { RegistriesFeature } from '../RegistriesFeature';

/** The hub's mount point. A CONSTANT in this suite rather than a literal at each render:
 *  the base is a prop now, so every case has to pass one, and the assertion below that the
 *  explorer receives it unchanged is only meaningful against the same string. */
const BASE = '/acme/registries';

/**
 * The route is a switch over a parsed selection now, not over segment counts — the grammar
 * itself is asserted without rendering in `paths.test.ts`. What is left here, and what only a
 * render can show, is that each arm of the union reaches the screen it names and carries its
 * whole selection there: a topic dropped on the way is a deep link that opens the right
 * registry on the wrong pane, which looks like a working link.
 *
 * The second describe below is the other half: the explorer configuration this route owns. It
 * carries the behaviours the deleted `RegistryList.test.tsx` used to assert against a list
 * component that no longer exists — the empty-state wording, the create affordance, and what
 * reaches the caller once a registry is made. They are the route's, not the explorer's: the
 * explorer decides when to show them, this file decides what they say and where they lead.
 */
describe('RegistriesFeature', () => {
  it('gives the owner’s selection to the explorer, whole', () => {
    render(
      <RegistriesFeature
        basePath={BASE}
        selection={{ kind: 'explorer', activeId: 'r1', activeTopic: 'signup-form' }}
      />,
    );
    const explorer = screen.getByTestId('explorer');
    expect([explorer.dataset.active, explorer.dataset.topic]).toEqual(['r1', 'signup-form']);
    // The feature's own base path, so every link the explorer builds stays inside the workspace.
    expect(explorer.dataset.base).toBe(BASE);
  });

  it('passes the explicitly-unselected state through rather than flattening it', () => {
    // `…/all` and a bare `…/registries` are different requests: `all` says "show me nothing
    // open", while the bare path lets the explorer resume what was open last.
    render(<RegistriesFeature basePath={BASE} selection={{ kind: 'explorer', all: true }} />);
    expect(screen.getByTestId('explorer').dataset.all).toBe('true');
    cleanup();

    render(<RegistriesFeature basePath={BASE} selection={{ kind: 'explorer' }} />);
    expect(screen.getByTestId('explorer').dataset.all).toBe('');
  });

  it('opens the registrant’s own entry, on the section the link named', () => {
    // The other screen entirely: the member's listing in someone else's registry. It shares no
    // state with the explorer, which is why it is a sibling component and not a topic.
    render(<RegistriesFeature basePath={BASE} selection={{ kind: 'joined', registryId: 'r1', section: 'about' }} />);
    const entry = screen.getByTestId('entry');
    expect([entry.dataset.registry, entry.dataset.section]).toEqual(['r1', 'about']);
    expect(screen.queryByTestId('explorer')).toBeNull();
  });

  it('opens the entry editor on its own default when the link named no section', () => {
    render(<RegistriesFeature basePath={BASE} selection={{ kind: 'joined', registryId: 'r1' }} />);
    expect(screen.getByTestId('entry').dataset.section).toBe('');
  });
});

describe('RegistriesFeature — the rail the owner meets', () => {
  it('says so when there are no registries yet', () => {
    // Carried over from `RegistryList.test.tsx`. The wording is the whole of what a new owner
    // sees on this feature, and it now travels as a prop rather than as JSX, which is exactly
    // the shape that goes missing without being noticed.
    render(<RegistriesFeature basePath={BASE} selection={{ kind: 'explorer' }} />);
    expect(screen.getByTestId('rail-empty').textContent).toBe(
      'You have not built a registry yet.',
    );
  });

  it('gives a failed list to the rail, which is the only surface that can show it', () => {
    // `useResourceList` leaves `items` null forever after a failure, so a rail that was not
    // handed the error would sit on "Loading…" with nothing to say — a hung screen rather than
    // a reported one.
    h.list.error = new Error('registries unavailable');
    render(<RegistriesFeature basePath={BASE} selection={{ kind: 'explorer' }} />);
    expect(screen.getByTestId('rail-error').textContent).toBe('registries unavailable');
  });

  it('keeps the create verb behind the gear, and hands the created id to the explorer', async () => {
    // Two behaviours the old list suite covered and nothing else does. FIRST: the create verb
    // is a gear-menu item, not a standalone control beside the rail heading — the rule every
    // other workspace feature follows, and one a `renderNewControl` that fell back to the
    // explorer's own button would silently break. SECOND: what the route hands `onCreated` is
    // the new registry's ID, which is what the explorer selects and routes to; handing it the
    // whole row (or nothing) creates a registry the owner is then left hunting for in the rail.
    render(<RegistriesFeature basePath={BASE} selection={{ kind: 'explorer' }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Registry actions' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'New registry…' }));

    await userEvent.type(await screen.findByLabelText('Name'), 'Coaches');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(h.createRegistry).toHaveBeenCalledWith({ slug: 'coaches', name: 'Coaches' }),
    );
    await waitFor(() => expect(h.created).toEqual(['r_new']));
  });
});
