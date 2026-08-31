// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { EntryRow, RegistryClient } from '@agentic-toolkit/registry/client';
import { PendingEntriesPanel } from '../PendingEntriesPanel';

// See RegistryEditor.test.tsx: no `test.globals`, so @testing-library's automatic cleanup
// never registers.
afterEach(cleanup);

// Annotated `EntryRow`, not left to inference: every field below is checked against the
// client's own unions, so a fixture that has drifted from the shape the panel is handed at run
// time is a compile error here. Unannotated, the literal widened to `string` and only the one
// call site that passes it somewhere TYPED would have noticed.
const entry = (patch: Partial<EntryRow> = {}): EntryRow => ({
  id: 'e1', registryId: 'r1', slug: 'mike', displayName: 'Mike', summary: 'Coaching',
  photoAttachmentId: null, providerType: 'person', category: '', keywords: [],
  locationText: '', countryCode: '', regionCode: '', geo: null, areaServed: {},
  deliveryMode: 'virtual', links: [], contactMode: 'dm', languages: [],
  status: 'pending', visibility: 'public', values: {}, valueVisibility: {},
  createdAt: '2026-08-01 09:15:00', ...patch,
});

function renderPanel(over: Partial<RegistryClient> = {}) {
  const client = {
    listEntries: vi.fn().mockResolvedValue({ items: [entry()] }),
    updateEntry: vi.fn().mockResolvedValue(entry({ status: 'published' })),
    ...over,
  } as unknown as RegistryClient;
  render(<PendingEntriesPanel title="Submissions" registryId="r1" client={client} />);
  return client;
}

describe('PendingEntriesPanel', () => {
  it('asks for the pending entries only', async () => {
    // The filter IS the queue. Without it this lists every entry in the registry and offers to
    // "approve" listings that are already live — and the owner cannot tell from the row which
    // is which, because a row that needs no decision looks exactly like one that does.
    const client = renderPanel();
    await screen.findByText('Mike');
    expect(client.listEntries).toHaveBeenCalledWith('r1', 'pending');
  });

  it('says so when nothing is waiting', async () => {
    // The wording is the assertion: this list asks for `status=pending`, so an empty answer
    // says nobody is WAITING, not that nobody has signed up. The stronger claim it used to make
    // sent owners hunting for a bug in a registry whose providers had all been approved.
    renderPanel({ listEntries: vi.fn().mockResolvedValue({ items: [] }) });
    expect(
      await screen.findByText('Nothing is waiting for review. New submissions show up here.'),
    ).toBeInTheDocument();
  });

  it('publishes the listing when the owner approves it, and drops the row', async () => {
    // `status: 'published'` and nothing else. A payload carrying any other field would be the
    // owner overwriting a registrant's answers with whatever this list happened to hold.
    const client = renderPanel();
    await userEvent.click(await screen.findByRole('button', { name: 'Approve Mike' }));
    await waitFor(() =>
      expect(client.updateEntry).toHaveBeenCalledWith('r1', 'e1', { status: 'published' }),
    );
    await waitFor(() => expect(screen.queryByText('Mike')).toBeNull());
  });

  it('sends a listing back to draft rather than only ever saying yes', async () => {
    const client = renderPanel();
    await userEvent.click(await screen.findByRole('button', { name: 'Send Mike back' }));
    await waitFor(() =>
      expect(client.updateEntry).toHaveBeenCalledWith('r1', 'e1', { status: 'draft' }),
    );
  });

  it('keeps the row and repeats the server’s own words when publishing is refused', async () => {
    // `assertPublishable` answers with the LABELS of the fields still missing. That list is the
    // entire content of the message: an owner told only "could not publish" has nothing to tell
    // the registrant, and the row has to stay so they can try again once it is fixed.
    renderPanel({
      updateEntry: vi.fn().mockRejectedValue(new Error('Still needed: Bio, Rate')),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Approve Mike' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Still needed: Bio, Rate');
    expect(screen.getByText('Mike')).toBeInTheDocument();
  });

  it('keeps a row disabled by its OWN decision, not by whichever one finished last', async () => {
    // RR2-I2. Every other case here drives ONE decision at a time, and a single
    // `busyId: string | null` is indistinguishable from a per-row flag until two are in flight
    // — which is exactly what a review queue invites, because an owner works down it clicking.
    // Two rows, two PATCHes deliberately left unanswered, so both are pending at once.
    const answer = new Map<string, (row: EntryRow) => void>();
    renderPanel({
      listEntries: vi.fn().mockResolvedValue({
        items: [entry(), entry({ id: 'e2', slug: 'ada', displayName: 'Ada' })],
      }),
      updateEntry: vi.fn(
        (_registryId: string, entryId: string) =>
          new Promise<EntryRow>((resolve) => answer.set(entryId, resolve)),
      ),
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Approve Mike' }));
    await userEvent.click(screen.getByRole('button', { name: 'Approve Ada' }));

    // Mike's PATCH has not answered, so Mike's buttons must still be shut. With one shared
    // flag, starting Ada's decision reopens them — and a second click there sends a second
    // PATCH that can land after the first, settling the entry on whichever the SERVER
    // finished last rather than on the owner's last instruction.
    expect(screen.getByRole('button', { name: 'Approve Mike' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send Mike back' })).toBeDisabled();

    // Ada finishing is not Mike finishing. `waitFor` on Ada's row leaving the queue is what
    // flushes her `finally`, so the assertion after it reads state that has already settled.
    answer.get('e2')!(entry({ id: 'e2', slug: 'ada', displayName: 'Ada', status: 'published' }));
    await waitFor(() => expect(screen.queryByText('Ada')).toBeNull());
    expect(screen.getByRole('button', { name: 'Approve Mike' })).toBeDisabled();

    // And Mike's own answer is what reopens Mike — here, by taking the row off the queue.
    answer.get('e1')!(entry({ status: 'published' }));
    await waitFor(() => expect(screen.queryByText('Mike')).toBeNull());
  });

  it('surfaces a load failure instead of an empty queue', async () => {
    // An empty queue and an unreadable one look identical, and one of them means the owner is
    // ignoring submissions they were never shown.
    renderPanel({ listEntries: vi.fn().mockRejectedValue(new Error('forbidden')) });
    expect(await screen.findByRole('alert')).toHaveTextContent('forbidden');
  });
});
