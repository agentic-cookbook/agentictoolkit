// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { EntryRow, RegistryClient } from '@agentic-toolkit/registry/client';
import { RegistryProvidersPanel } from '../RegistryProvidersPanel';

// See RegistryEditor.test.tsx: no `test.globals`, so @testing-library's automatic cleanup
// never registers.
afterEach(cleanup);

// Annotated `EntryRow` for the same reason `PendingEntriesPanel.test.tsx` annotates its own:
// every field is then checked against the client's unions, so a fixture that has drifted from
// the shape the panel is handed at run time is a compile error here rather than a green test.
const entry = (patch: Partial<EntryRow> = {}): EntryRow => ({
  id: 'e1', registryId: 'r1', slug: 'mike', displayName: 'Mike', summary: 'Coaching',
  photoAttachmentId: null, providerType: 'person', category: '', keywords: [],
  locationText: 'Berlin', countryCode: 'DE', regionCode: '', geo: null, areaServed: {},
  deliveryMode: 'virtual', links: [], contactMode: 'dm', languages: [],
  status: 'published', visibility: 'public', values: {}, valueVisibility: {},
  createdAt: '2026-08-01 23:59:00', ...patch,
});

/** Three statuses and two provider types, because the facets are what the roster adds. */
const roster = [
  entry(),
  entry({
    id: 'e2', slug: 'acme', displayName: 'Acme', providerType: 'organization',
    status: 'pending', locationText: 'Lisbon', createdAt: '2026-08-03 11:00:00',
  }),
  entry({
    id: 'e3', slug: 'dana', displayName: 'Dana', status: 'draft',
    locationText: 'Oslo', createdAt: '2026-07-20 08:00:00',
  }),
];

/** The registry half of the editor — loaded beside the roster, so Edit opens on the spot. */
const registry = {
  id: 'r1', slug: 'coaches', name: 'Coaches', purpose: '', description: '',
  categoryRoot: 'coaching', entryTerm: 'coach', visibility: 'private',
  submissionPolicy: 'open', servicesEnabled: false, boundSiteId: null,
};
const sections = [{ id: 's1', key: 'about', label: 'About you', description: '', sortOrder: 0 }];
const fieldDefs = [{
  id: 'f1', sectionId: 's1', key: 'bio', type: 'text', label: 'Bio', help: '',
  required: false, sortOrder: 0, config: {}, visibility: 'public', showIf: null,
}];

function renderPanel(over: Partial<RegistryClient> = {}) {
  const client = {
    listEntries: vi.fn().mockResolvedValue({ items: roster }),
    deleteEntry: vi.fn().mockResolvedValue(undefined),
    getRegistry: vi.fn().mockResolvedValue(registry),
    listSections: vi.fn().mockResolvedValue({ items: sections }),
    listFieldDefs: vi.fn().mockResolvedValue({ items: fieldDefs }),
    updateEntry: vi.fn(async (_r: string, _id: string, patch: Partial<EntryRow>) => ({
      ...roster[0], ...patch,
    })),
    ...over,
  } as unknown as RegistryClient;
  render(<RegistryProvidersPanel title="Providers" registryId="r1" client={client} />);
  return client;
}

/** Tick a row's own selection checkbox — `describeRow` names each one after the provider. */
async function select(name: string) {
  await userEvent.click(screen.getByRole('checkbox', { name: `Select ${name}` }));
}

/**
 * Press Remove in the bar, then Remove in the confirm.
 *
 * Scoped through the dialog deliberately: both buttons read "Remove", which is the point —
 * the second press is a confirmation of the first, not a differently-named action.
 */
async function removeSelected() {
  await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
  const dialog = await screen.findByRole('dialog');
  await userEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
}

describe('RegistryProvidersPanel', () => {
  it('asks for every status, which is what makes it the roster', async () => {
    // The queue beside it passes `'pending'`. Passing anything here would turn this into a
    // second copy of that screen and leave "who is actually in my registry?" unanswerable —
    // a listing an owner published would vanish from the only list naming their registrants.
    const client = renderPanel();
    await screen.findByText('Mike');
    expect(client.listEntries).toHaveBeenCalledWith('r1');
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('Dana')).toBeInTheDocument();
  });

  it('says each status in the word the two people involved have already been shown', async () => {
    // Not the stored token. The owner chose "Anyone, but I approve each one" and the
    // registrant was told their listing was submitted — neither has ever seen `pending`.
    renderPanel();
    expect(await screen.findByText('Listed')).toBeInTheDocument();
    expect(screen.getByText('Submitted')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.queryByText('pending')).toBeNull();
  });

  it('reads the signup date as the zoneless UTC stamp Postgres sends', async () => {
    // `2026-08-01 23:59:00` — a space, no zone, and deliberately close enough to midnight to
    // cross a date boundary: a bare `new Date()` reads that shape as LOCAL, so east of UTC it
    // renders the day before the one the row was actually created on. Compared against the
    // locale's own rendering rather than a literal, because `formatDate` is `toLocaleDateString`
    // and a literal would pin this test to whatever locale the runner happens to have.
    renderPanel();
    const expected = new Date('2026-08-01T23:59:00Z').toLocaleDateString();
    expect(await screen.findByText(expected)).toBeInTheDocument();
    expect(screen.queryByText('2026-08-01 23:59:00')).toBeNull();
  });

  it('says so when nobody has signed up', async () => {
    renderPanel({ listEntries: vi.fn().mockResolvedValue({ items: [] }) });
    expect(await screen.findByText('Nobody has signed up to this registry yet.'))
      .toBeInTheDocument();
  });

  it('says the load failed instead of showing an empty registry', async () => {
    // An empty roster and an unreachable one look identical, and the wrong one of those two
    // reads as "nobody signed up" to an owner whose registrants are all still there.
    renderPanel({ listEntries: vi.fn().mockRejectedValue(new Error('nope')) });
    expect(await screen.findByText("Couldn't load this registry's providers"))
      .toBeInTheDocument();
    expect(screen.queryByText('Nobody has signed up to this registry yet.')).toBeNull();
  });

  it('removes only what the owner selected, and only once they confirm', async () => {
    // The bar acts on the selection, so nothing happens until the confirm: a Remove that
    // fired on the first click would put one keystroke between an owner and a listing that
    // nothing here puts back.
    const client = renderPanel();
    await screen.findByText('Mike');
    await select('Mike');
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(client.deleteEntry).not.toHaveBeenCalled();

    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(client.deleteEntry).toHaveBeenCalledWith('r1', 'e1'));
    expect(client.deleteEntry).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByText('Mike')).toBeNull());
    expect(screen.getByText('Acme')).toBeInTheDocument();
  });

  it('keeps a row that failed to go, selected and named', async () => {
    // A bulk remove is the one gesture where an owner most needs to know exactly what
    // survived: the ones that went are gone from the list, the one that did not is still
    // ticked, so the retry is one press rather than a re-tick of everything.
    const client = renderPanel({
      deleteEntry: vi.fn(async (_registryId: string, id: string) => {
        if (id === 'e2') throw new Error('not yours to remove');
      }),
    });
    await screen.findByText('Mike');
    await select('Mike');
    await select('Acme');
    await removeSelected();

    await waitFor(() => expect(screen.queryByText('Mike')).toBeNull());
    expect(await screen.findByText(/Acme: not yours to remove/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Select Acme' })).toBeChecked();
    expect(client.deleteEntry).toHaveBeenCalledTimes(2);
  });

  it('shows the selected provider\'s profile under the list, in the registrant\'s own words', async () => {
    // The columns answer "who is in here?"; the pane answers "what does this one offer?". The
    // words are the ones the registrant picked in their own editor — "Online", not `virtual` —
    // because an owner reading a different phrase for the same stored token has no way to tell
    // whether they are looking at the same setting.
    renderPanel();
    await screen.findByText('Mike');
    expect(screen.getByText('Select a provider to see their profile.')).toBeInTheDocument();

    await select('Mike');
    expect(await screen.findByText('Coaching')).toBeInTheDocument();
    expect(screen.getByText('Online')).toBeInTheDocument();
    expect(screen.getByText('Berlin — DE')).toBeInTheDocument();
    expect(screen.queryByText('virtual')).toBeNull();
  });

  it('asks for a single provider when several are ticked', async () => {
    // A profile is about one person, and the bar beside it acts on the whole selection — so the
    // pane says which of the two gestures it is answering rather than picking one of them.
    renderPanel();
    await screen.findByText('Mike');
    await select('Mike');
    await select('Acme');
    expect(await screen.findByText('Select a single provider to see their profile.'))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit/i })).toBeDisabled();
  });

  it('opens the registrant\'s own editor over the selected provider, and comes back', async () => {
    // Not a second owner-side editor: the same form, over somebody else's entry. `updateEntry`
    // is what the registrant's editor calls too, and the backend does not re-gate an owner's
    // PATCH — so a fix an owner makes and a fix the registrant makes are the same write.
    renderPanel();
    await screen.findByText('Mike');
    await select('Mike');
    await userEvent.click(screen.getByRole('button', { name: /edit/i }));

    // The editor's own leaf, which only renders once the form has loaded — the roster is gone
    // and what replaced it is the signup form, not a spinner. (The section labels themselves
    // are not assertable here: `StackGroupDetail` publishes its rail into the workspace shell
    // rather than into this subtree, the same reason `EntryEditorRoute.test.tsx` gives.)
    expect(await screen.findByText('Pick a section to fill in.')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Select Acme' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(await screen.findByRole('checkbox', { name: 'Select Acme' })).toBeInTheDocument();
  });
});
