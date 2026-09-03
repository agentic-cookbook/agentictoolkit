import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';

import { useStackLevel } from '@agentic-toolkit/resource';

import type { AccessVerb, DevRepo, Environment, RepoItem } from '../types';

/**
 * The Configure dialog's FRAME — the three things that are true of it before any of its
 * contents are: where the bar is, what the footer's two buttons commit, and that Connections
 * is a dialog of its own.
 *
 * All three were reported as defects against a build that had none of them, and two of the
 * three are invisible to a type checker and to every other test in this package: a bar
 * hung inside the rail still renders, a modal with no footer still closes, and a rail level
 * published where the stack cannot reach it still registers. The only way any of them fails
 * loudly is a test that asks the DOM where things ended up.
 *
 * `IntegrationsPane` is stood in for, because what is being pinned is not the pane — it is
 * the POSITION the pane is mounted in. The stub publishes a rail level with an `onNew`
 * exactly as the real one does, through the real `useStackLevel` and the real rail host, so
 * the "Add integration" button it asks for is drawn by the real machinery or not at all.
 * Under the old arrangement it was not: the pane sat in Configure's detail area while
 * Configure's repository list was UNSELECTED, and `HierarchicalDetailView` renders levels
 * only as far as the first unselected one, so the level carrying that button was sliced off
 * every time.
 */

vi.mock('@agentic-toolkit/data/ecosystems', () => ({
  useWorkspaceDefaultEcosystemId: () => ({
    ecosystemId: 'eco-1',
    canManage: true,
    isPending: false,
    isFetching: false,
    isError: false,
  }),
}));

vi.mock('@agentic-toolkit/integrations', () => ({
  IntegrationsPane: ({ levelTitle }: { levelTitle?: string }) => {
    useStackLevel({
      id: 'integrations-list',
      title: levelTitle ?? 'Integrations',
      items: [],
      selectedId: null,
      onSelect: () => {},
      onClear: () => {},
      newLabel: 'Add integration',
      onNew: () => {},
    });
    return <div>integrations detail</div>;
  },
}));

const { ConfigureDialog } = await import('../configure/ConfigureDialog');

const DEV_REPO: DevRepo = {
  id: 'd1',
  slug: 'acme/site',
  mainBranch: 'main',
  preparedBranch: 'prepared',
  declarationSha: null,
  connectionId: 'c1',
};

function mirror(envBranches: Partial<Record<Environment, string>>): RepoItem {
  return {
    id: 'm1',
    devRepoId: DEV_REPO.id,
    groupId: null,
    slug: 'acme/site-deployment',
    shard: 'all',
    shipBranch: 'ship',
    ciContext: 'gate',
    envBranches,
    registeredAt: null,
    position: 0,
    devRepo: DEV_REPO,
    state: null,
  };
}

function draw(items: RepoItem[] = []) {
  const onClose = vi.fn();
  const onSaveSettings = vi.fn(() => Promise.resolve());
  const onImport = vi.fn(() => Promise.resolve());
  render(
    <ConfigureDialog
      open
      onClose={onClose}
      client={{ workspace: 'acme' } as never}
      groups={[]}
      items={items}
      verbs={['C', 'R', 'U', 'D', 'M']}
      onRegister={() => Promise.resolve()}
      onRemove={() => Promise.resolve()}
      onSaveSettings={onSaveSettings}
      onImport={onImport}
    />,
  );
  return { onClose, onSaveSettings, onImport };
}

/** The dialog with this title, of however many are open. */
const dialog = (title: string) =>
  screen
    .getAllByRole('dialog')
    .find((d) => within(d).queryByText(title, { selector: '[data-slot="dialog-title"]' }))!;

describe('the Configure dialog frame', () => {
  it('draws the bar above the rail, not inside its list', async () => {
    draw([mirror({})]);
    const add = await screen.findByRole('button', { name: 'Add' });
    // Measured against the breadcrumb, which is the FIRST thing the view draws: a bar hung
    // off the level as its `headerSlot` lands inside the list column, which is below it.
    // Anything that renders after the breadcrumb is inside the rail, not above it.
    const [breadcrumb] = screen.getAllByText('Repositories');
    expect(
      add.compareDocumentPosition(breadcrumb!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('closes on Cancel without writing the boxes that were ticked', async () => {
    const { onClose, onSaveSettings } = draw([mirror({})]);
    await userEvent.click(await screen.findByText('acme/site'));
    await userEvent.click(await screen.findByRole('checkbox', { name: /testing/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onSaveSettings).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('writes the boxes and closes on OK', async () => {
    const { onClose, onSaveSettings } = draw([mirror({ testing: 'release/next' })]);
    await userEvent.click(await screen.findByText('acme/site'));
    await userEvent.click(await screen.findByRole('checkbox', { name: /staging/i }));
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));
    await waitFor(() => expect(onSaveSettings).toHaveBeenCalled());
    expect(onSaveSettings.mock.calls[0]![0]).toEqual([
      { repoId: 'm1', envBranches: { testing: 'release/next', staging: 'staging' } },
    ]);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('leaves the repository settings one Save, not two', async () => {
    // The footer's OK IS the Save. An inline one beside it would be a second control writing
    // the same patch, and a second answer to "did that go through".
    draw([mirror({})]);
    await userEvent.click(await screen.findByText('acme/site'));
    await screen.findByRole('checkbox', { name: /testing/i });
    expect(screen.queryByRole('button', { name: /^Save/ })).toBeNull();
  });

  it('opens Connections as its own dialog, where its add button can be drawn', async () => {
    draw();
    await userEvent.click(await screen.findByRole('button', { name: 'Connections' }));
    const connections = await waitFor(() => dialog('Connections'));
    // The whole point: the integrations level is the FIRST level of this dialog's own rail
    // rather than an orphan under Configure's unselected repository list, so the "+" it
    // publishes is inside the frontier the view renders.
    expect(
      within(connections).getByRole('button', { name: 'Add integration' }),
    ).toBeInTheDocument();
    // And it is a second dialog, not a pane: Configure is still open behind it.
    expect(dialog('Configure')).toBeTruthy();
  });
});

describe('the fleet as a file', () => {
  /**
   * A refused bar button SAYS SO WHEN PRESSED. It is `aria-disabled`, never natively
   * `disabled`: Chrome dispatches no hover over a disabled button and shows no `title`
   * tooltip for one, so the old contract — the reason on `title` — could only be read by
   * someone who already knew what it said. "The import button does nothing" (Mike) was
   * exactly that, on the sibling control.
   */
  it('says why when a refused bar button is pressed', async () => {
    const user = userEvent.setup();
    draw();
    const button = screen.getByRole('button', { name: 'Export' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    // Not `disabled` — that is what swallowed the press and the explanation with it.
    expect(button).not.toBeDisabled();

    await user.click(button);
    expect(await screen.findByText('Nothing is registered yet.')).toBeInTheDocument();
  });

  it('writes a file of the rows on the screen', async () => {
    // Every part of the export is stubbed except the one thing worth pinning here: that the
    // button reaches the file at all. What goes IN the file is `buildDocument`'s, and is
    // pinned against the CLI's own output in exchange.test.ts.
    const createObjectURL = vi.fn(() => 'blob:configure');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    draw([mirror({})]);
    await userEvent.click(screen.getByRole('button', { name: 'Export' }));

    expect(click).toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalled();
    click.mockRestore();
  });

  it('opens the import dialog rather than importing anything on the press', async () => {
    const { onImport } = draw([mirror({})]);
    await userEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(await waitFor(() => dialog('Import configuration'))).toBeTruthy();
    // The bar button opens a plan; it never applies one.
    expect(onImport).not.toHaveBeenCalled();
  });
});

/**
 * Connections is the one modal in this console whose open-ness is in the URL, and the reason
 * is that it is the one an operator can LEAVE THE APP from. Connecting a GitHub App sends the
 * browser to github.com; `/integrations/oauth-callback` returns it to the URL the connect
 * started on. Every other dialog here is React state and can be, because nothing ever unmounts
 * the page beneath it — this one has to survive a document that was thrown away and rebuilt.
 *
 * Without the hash the operator came back to a bare tree with every dialog closed and their
 * new connection nowhere in sight, which reads as the connect having failed. Nothing about
 * that is visible to a type checker, and no other test in this package ever leaves the page.
 */
describe('Connections is the one dialog the address bar knows about', () => {
  const at = (url: string) => window.history.replaceState(null, '', url);

  beforeEach(() => at('/acme/repos?workspace=acme'));
  afterEach(() => at('/'));

  it('writes the hash when Connections opens, leaving the path and query alone', async () => {
    draw();
    await userEvent.click(await screen.findByRole('button', { name: 'Connections' }));
    await waitFor(() => expect(window.location.hash).toBe('#connections'));
    // `?workspace=` is what the console reads its tree with, so a round-trip that dropped it
    // would come back to someone else's workspace — or to none.
    expect(window.location.pathname).toBe('/acme/repos');
    expect(window.location.search).toBe('?workspace=acme');
  });

  it('opens Connections straight away when the address already names it', async () => {
    // The shape of the return leg: the callback routed here, and this body mounts fresh.
    at('/acme/repos?workspace=acme#connections');
    draw();
    expect(await waitFor(() => dialog('Connections'))).toBeTruthy();
  });

  it('takes the hash back out when Connections closes', async () => {
    at('/acme/repos?workspace=acme#connections');
    draw();
    const connections = await waitFor(() => dialog('Connections'));
    await userEvent.click(within(connections).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(window.location.hash).toBe(''));
    expect(window.location.pathname).toBe('/acme/repos');
  });

  it('takes the hash back out when Configure itself closes', async () => {
    at('/acme/repos?workspace=acme#connections');
    // Configure closing unmounts the body, so its own effect can never see the change — the
    // cleanup is what clears the address. A stale `#connections` would reopen Connections on
    // the next Configure, over and over, with no way to make it stop.
    const props = {
      onClose: () => {},
      client: { workspace: 'acme' } as never,
      groups: [],
      items: [],
      verbs: ['C', 'R', 'U', 'D', 'M'] as AccessVerb[],
      onRegister: () => Promise.resolve(),
      onRemove: () => Promise.resolve(),
      onSaveSettings: () => Promise.resolve(),
      onImport: () => Promise.resolve(),
    };
    const { rerender } = render(<ConfigureDialog open {...props} />);
    await waitFor(() => dialog('Connections'));
    rerender(<ConfigureDialog open={false} {...props} />);
    await waitFor(() => expect(window.location.hash).toBe(''));
  });
});
