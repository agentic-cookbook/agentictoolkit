// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RegistryClient, ServiceRow } from '@agentic-toolkit/registry/client';

import { EntryServicesPanel } from '../EntryServicesPanel';

const row = (patch: Partial<ServiceRow> = {}): ServiceRow => ({
  id: 's1', title: 'Audit', description: '', pricingModel: 'hourly',
  priceMin: 200, priceMax: null, currency: 'USD', unit: 'hour',
  deliveryMode: 'virtual', sortOrder: 0, ...patch,
});

/** A promise this test resolves on its own schedule, to pin two saves in flight at once. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function renderPanel(client: Partial<RegistryClient>, onDirtyChange = vi.fn()) {
  return {
    onDirtyChange,
    ...render(
      <EntryServicesPanel
        client={
          { listServices: vi.fn().mockResolvedValue({ items: [] }), ...client } as unknown as RegistryClient
        }
        registryId="r1"
        entryId="e1"
        onDirtyChange={onDirtyChange}
      />,
    ),
  };
}

/**
 * Removing a SAVED row asks first, so every test that removes one has to answer.
 *
 * jsdom ships no `window.confirm` — it logs "Not implemented" and returns undefined, which is
 * falsy, so an unstubbed removal silently does nothing and the test fails somewhere far from
 * the cause. Answering "yes" by default keeps that plumbing out of the tests that are about
 * ordering and in-flight saves; the three tests that are about the prompt itself read or
 * re-point this spy.
 */
// Typed off the helper's own return rather than `vi.spyOn<Window, 'confirm'>`: that overload's
// key parameter is constrained to Window's DATA properties, so naming a method there is a
// TS2344 — and the inferred form needs no maintenance when vitest's mock types move.
function stubConfirm() {
  return vi.spyOn(window, 'confirm').mockReturnValue(true);
}
let confirmed: ReturnType<typeof stubConfirm>;
beforeEach(() => {
  confirmed = stubConfirm();
});

afterEach(() => {
  cleanup();
  confirmed.mockRestore();
});

describe('EntryServicesPanel', () => {
  it('loads this entry’s services', async () => {
    const listServices = vi.fn().mockResolvedValue({ items: [row()] });
    renderPanel({ listServices });
    expect(await screen.findByDisplayValue('Audit')).not.toBeNull();
    expect(listServices).toHaveBeenCalledWith('r1', 'e1');
  });

  it('says so plainly when there are none', async () => {
    renderPanel({});
    expect(await screen.findByText('No services yet.')).not.toBeNull();
  });

  it('adds a local row that is not on the server until it is saved', async () => {
    const createService = vi.fn();
    renderPanel({ createService });
    await userEvent.click(await screen.findByRole('button', { name: 'Add a service' }));
    expect(screen.getByLabelText('Service 1 title')).not.toBeNull();
    // A blank row POSTed on click would write junk the moment someone clicks and wanders off,
    // and `serviceWrite.title` is `.min(1)` so it would 400 anyway.
    expect(createService).not.toHaveBeenCalled();
  });

  it('will not save a row with no title', async () => {
    renderPanel({});
    await userEvent.click(await screen.findByRole('button', { name: 'Add a service' }));
    expect(screen.getByRole('button', { name: 'Save service 1' }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('creates a titled row and adopts the server’s id', async () => {
    const createService = vi.fn().mockResolvedValue(row({ id: 's_new', title: 'Coaching' }));
    renderPanel({ createService });
    await userEvent.click(await screen.findByRole('button', { name: 'Add a service' }));
    await userEvent.type(screen.getByLabelText('Service 1 title'), 'Coaching');
    await userEvent.click(screen.getByRole('button', { name: 'Save service 1' }));

    await waitFor(() => expect(createService).toHaveBeenCalled());
    expect(createService.mock.calls[0]!.slice(0, 2)).toEqual(['r1', 'e1']);
    expect(createService.mock.calls[0]![2]).toMatchObject({ title: 'Coaching' });
    // Adopting the id is what makes the NEXT save an update rather than a duplicate row.
    expect(screen.getByRole('button', { name: 'Save service 1' }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('updates an existing row by id', async () => {
    const updateService = vi.fn().mockResolvedValue(row({ title: 'Audit!' }));
    renderPanel({ listServices: vi.fn().mockResolvedValue({ items: [row()] }), updateService });
    await userEvent.type(await screen.findByLabelText('Service 1 title'), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Save service 1' }));
    await waitFor(() => expect(updateService).toHaveBeenCalled());
    expect(updateService.mock.calls[0]!.slice(0, 3)).toEqual(['r1', 'e1', 's1']);
  });

  it('hides the money boxes for a pricing model that has no money', async () => {
    renderPanel({ listServices: vi.fn().mockResolvedValue({ items: [row()] }) });
    expect(await screen.findByLabelText('Service 1 from', { exact: false })).not.toBeNull();
    await userEvent.selectOptions(screen.getByLabelText('Service 1 pricing'), 'barter');
    expect(screen.queryByLabelText('Service 1 from', { exact: false })).toBeNull();
  });

  it('sends a blank price as null, never as zero', async () => {
    const updateService = vi.fn().mockResolvedValue(row());
    renderPanel({ listServices: vi.fn().mockResolvedValue({ items: [row()] }), updateService });
    await userEvent.clear(await screen.findByLabelText('Service 1 from', { exact: false }));
    await userEvent.click(screen.getByRole('button', { name: 'Save service 1' }));
    await waitFor(() => expect(updateService).toHaveBeenCalled());
    // `0` renders as "free", which is a different claim from "not stated".
    expect(updateService.mock.calls[0]![3]).toMatchObject({ priceMin: null });
  });

  it('sends each row’s own position, so the order on screen is the order that is stored', async () => {
    // Minor `sv-sortorder`: `sortOrder: index` → `0` left the suite green. The read side orders
    // by it (`registryEntries.ts:739`, `orderBy(asc(sortOrder))`), so writing 0 for every row
    // makes every service tie and the list comes back in whatever order the database feels
    // like — the owner's arrangement is silently discarded. Row 2 is the one saved here
    // precisely because row 1's index IS 0: saving the first row cannot tell the two apart.
    // The body parameter is declared even though the implementation ignores it: `mock.calls` is
    // typed as a tuple from this signature, so omitting it makes `calls[0][3]` a tsc error.
    const updateService = vi.fn(
      (_r: string, _e: string, id: string, _body: Partial<ServiceRow>) =>
        Promise.resolve(row({ id, title: 'Coaching!' })),
    );
    renderPanel({
      listServices: vi.fn().mockResolvedValue({
        items: [row({ id: 's1', title: 'Audit' }), row({ id: 's2', title: 'Coaching' })],
      }),
      updateService,
    });
    await userEvent.type(await screen.findByLabelText('Service 2 title'), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Save service 2' }));
    await waitFor(() => expect(updateService).toHaveBeenCalled());
    expect(updateService.mock.calls[0]![3]).toMatchObject({ sortOrder: 1 });
  });

  it('deletes a saved row on the server, once the registrant confirms', async () => {
    const deleteService = vi.fn().mockResolvedValue({});
    renderPanel({ listServices: vi.fn().mockResolvedValue({ items: [row()] }), deleteService });
    await userEvent.click(await screen.findByRole('button', { name: 'Remove service 1' }));
    await waitFor(() => expect(deleteService).toHaveBeenCalledWith('r1', 'e1', 's1'));
    expect(screen.queryByDisplayValue('Audit')).toBeNull();
    // The row's own name has to be IN the question — "Remove this service?" is the same
    // sentence for every row, so it cannot catch the mistake it exists to catch.
    expect(confirmed.mock.calls[0]![0]).toContain('Audit');
  });

  it('leaves a saved row alone when the registrant cancels', async () => {
    confirmed.mockReturnValue(false);
    const deleteService = vi.fn();
    renderPanel({ listServices: vi.fn().mockResolvedValue({ items: [row()] }), deleteService });
    await userEvent.click(await screen.findByRole('button', { name: 'Remove service 1' }));
    expect(deleteService).not.toHaveBeenCalled();
    // Still on screen: a cancel that removed the row locally would be the same data loss
    // the prompt exists to prevent, just without the DELETE.
    expect(screen.getByDisplayValue('Audit')).toBeTruthy();
  });

  it('drops an unsaved row without calling the server, and without asking', async () => {
    // Nothing to lose and nothing to undo — a prompt here is the one that trains people
    // to dismiss the prompt on the saved row.
    const deleteService = vi.fn();
    renderPanel({ deleteService });
    await userEvent.click(await screen.findByRole('button', { name: 'Add a service' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove service 1' }));
    expect(deleteService).not.toHaveBeenCalled();
    expect(confirmed).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Service 1 title')).toBeNull();
  });

  it('reports dirtiness up, so the exit guard covers this pane too', async () => {
    const { onDirtyChange } = renderPanel({
      listServices: vi.fn().mockResolvedValue({ items: [row()] }),
    });
    await userEvent.type(await screen.findByLabelText('Service 1 title'), '!');
    // Without this, a typed-but-unsaved service walks out of the rail silently — the entry's
    // own `dirty` flag knows nothing about a resource it does not own.
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));
  });

  it('reports each change of dirtiness once, not once per keystroke', async () => {
    // Carried :1209. `rows` is a fresh array per keystroke, so with the unmount report as the
    // reporting effect's own cleanup every character announced clean-then-dirty to the exit
    // guard. Harmless today only because React batches the pair into one commit; the guard is
    // one `if` away from reading the false and letting an unsaved pane walk.
    const { onDirtyChange } = renderPanel({
      listServices: vi.fn().mockResolvedValue({ items: [row()] }),
    });
    await userEvent.type(await screen.findByLabelText('Service 1 title'), '!!!');
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));
    expect(onDirtyChange.mock.calls).toEqual([[true]]);
  });

  it('surfaces a save failure and keeps the row dirty', async () => {
    const updateService = vi.fn().mockRejectedValue(new Error('Service unavailable'));
    renderPanel({ listServices: vi.fn().mockResolvedValue({ items: [row()] }), updateService });
    await userEvent.type(await screen.findByLabelText('Service 1 title'), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Save service 1' }));
    expect(await screen.findByText('Service unavailable')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Save service 1' }).hasAttribute('disabled')).toBe(
      false,
    );
  });

  it('blocks a save with no currency code and names why, on a priced row', async () => {
    renderPanel({ listServices: vi.fn().mockResolvedValue({ items: [row()] }) });
    await userEvent.clear(await screen.findByLabelText('Service 1 currency'));
    expect(screen.getByRole('button', { name: 'Save service 1' }).hasAttribute('disabled')).toBe(
      true,
    );
    expect(
      screen.getByText('A currency code is three letters — USD, EUR, GBP.'),
    ).not.toBeNull();
  });

  it('does not block a save on a missing currency when the pricing model has no money', async () => {
    // F3: the currency box is unmounted for `free`/`barter`, so checking it unconditionally
    // would block a save over a control the registrant cannot see — the exact failure the
    // check exists to prevent. `saveRow` also omits `currency` from the body in this case.
    const updateService = vi.fn().mockResolvedValue(row({ pricingModel: 'barter', currency: '' }));
    renderPanel({
      listServices: vi.fn().mockResolvedValue({
        items: [row({ pricingModel: 'barter', currency: '' })],
      }),
      updateService,
    });
    await userEvent.type(await screen.findByLabelText('Service 1 title'), '!');
    expect(screen.getByRole('button', { name: 'Save service 1' }).hasAttribute('disabled')).toBe(
      false,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save service 1' }));
    await waitFor(() => expect(updateService).toHaveBeenCalled());
    expect(updateService.mock.calls[0]![3]).not.toHaveProperty('currency');
  });

  it('disables the row while its own save is in flight, so mid-save keystrokes cannot be lost', async () => {
    let resolveUpdate!: (value: ServiceRow) => void;
    const updateService = vi.fn(
      () =>
        new Promise<ServiceRow>((resolve) => {
          resolveUpdate = resolve;
        }),
    );
    renderPanel({ listServices: vi.fn().mockResolvedValue({ items: [row()] }), updateService });
    await userEvent.type(await screen.findByLabelText('Service 1 title'), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Save service 1' }));
    await waitFor(() => expect(updateService).toHaveBeenCalled());
    // The row's own input is disabled for the round trip — otherwise keystrokes typed here get
    // silently overwritten by the pre-save snapshot the moment the response lands.
    expect(screen.getByLabelText('Service 1 title').hasAttribute('disabled')).toBe(true);
    resolveUpdate(row({ title: 'Audit!' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Service 1 title').hasAttribute('disabled')).toBe(false),
    );
  });

  // G1: `busy` is keyed by each row's own stable identity, not its array position, so two rows
  // saving at once (or a save outliving an earlier row's removal) can never cross wires.

  it('disables only the row being saved, and keeps every row on its own DOM node', async () => {
    // Carried :1374 + Minor `sv-row-key-index`. The first half of this test passes against the
    // single-index `busy` it was written for — saving row 1 sets `busy = 0`, and row 2 is at
    // index 1 either way — so on its own it guards nothing; the two racing tests below are what
    // actually killed that mutant. The second half is what earns it its place: `key={r.key}` →
    // `key={index}` also left the suite green, despite the docblock at `EntryServicesPanel.tsx:184`
    // explaining why position is unsafe. Removing an EARLIER row is where the two keyings
    // diverge — by identity React moves row 2's existing node up; by index it destroys that node
    // and rewrites row 1's in place, so a registrant mid-edit loses focus and any composition
    // state to a row they never touched. Node identity is the only observable that separates
    // them: the displayed value is the same under both.
    const d1 = deferred<ServiceRow>();
    const updateService = vi.fn((_r: string, _e: string, id: string) =>
      id === 's1' ? d1.promise : Promise.resolve(row({ id, title: 'Coaching' })),
    );
    const deleteService = vi.fn().mockResolvedValue({});
    renderPanel({
      listServices: vi.fn().mockResolvedValue({
        items: [row({ id: 's1', title: 'Audit' }), row({ id: 's2', title: 'Coaching' })],
      }),
      updateService,
      deleteService,
    });
    await userEvent.type(await screen.findByLabelText('Service 1 title'), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Save service 1' }));
    await waitFor(() => expect(updateService).toHaveBeenCalledTimes(1));

    expect(screen.getByLabelText('Service 1 title').hasAttribute('disabled')).toBe(true);
    const coaching = screen.getByLabelText('Service 2 title');
    expect(coaching.hasAttribute('disabled')).toBe(false);

    d1.resolve(row({ id: 's1', title: 'Audit!' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Service 1 title').hasAttribute('disabled')).toBe(false),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Remove service 1' }));
    await waitFor(() => expect(deleteService).toHaveBeenCalledWith('r1', 'e1', 's1'));

    // Same element, new label — the row moved, it was not rebuilt out of the row above it.
    expect(screen.getByLabelText('Service 1 title')).toBe(coaching);
    expect(coaching).toHaveValue('Coaching');
  });

  it('leaves row 1 disabled while its own save is pending, even after row 2 starts saving too', async () => {
    const d1 = deferred<ServiceRow>();
    const d2 = deferred<ServiceRow>();
    const updateService = vi.fn((_r: string, _e: string, id: string) =>
      id === 's1' ? d1.promise : d2.promise,
    );
    renderPanel({
      listServices: vi.fn().mockResolvedValue({
        items: [row({ id: 's1', title: 'Audit' }), row({ id: 's2', title: 'Coaching' })],
      }),
      updateService,
    });
    await userEvent.type(await screen.findByLabelText('Service 1 title'), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Save service 1' }));
    await waitFor(() => expect(updateService).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText('Service 1 title').hasAttribute('disabled')).toBe(true);

    await userEvent.type(await screen.findByLabelText('Service 2 title'), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Save service 2' }));
    await waitFor(() => expect(updateService).toHaveBeenCalledTimes(2));

    // Row 2 starting its own save must not re-enable row 1 — row 1's request is still in flight.
    // On the old single-index `busy`, `setBusy(1)` for row 2 clobbers row 1's flag here.
    expect(screen.getByLabelText('Service 1 title').hasAttribute('disabled')).toBe(true);
    expect(screen.getByLabelText('Service 2 title').hasAttribute('disabled')).toBe(true);

    d1.resolve(row({ id: 's1', title: 'Audit!' }));
    d2.resolve(row({ id: 's2', title: 'Coaching!' }));
  });

  it('re-enables a row as soon as its own save resolves, independent of the other row', async () => {
    const d1 = deferred<ServiceRow>();
    const d2 = deferred<ServiceRow>();
    const updateService = vi.fn((_r: string, _e: string, id: string) =>
      id === 's1' ? d1.promise : d2.promise,
    );
    renderPanel({
      listServices: vi.fn().mockResolvedValue({
        items: [row({ id: 's1', title: 'Audit' }), row({ id: 's2', title: 'Coaching' })],
      }),
      updateService,
    });
    await userEvent.type(await screen.findByLabelText('Service 1 title'), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Save service 1' }));
    await userEvent.type(await screen.findByLabelText('Service 2 title'), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Save service 2' }));
    await waitFor(() => expect(updateService).toHaveBeenCalledTimes(2));

    d2.resolve(row({ id: 's2', title: 'Coaching!' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Service 2 title').hasAttribute('disabled')).toBe(false),
    );
    expect(screen.getByLabelText('Service 1 title').hasAttribute('disabled')).toBe(true);

    d1.resolve(row({ id: 's1', title: 'Audit!' }));
    await waitFor(() =>
      expect(screen.getByLabelText('Service 1 title').hasAttribute('disabled')).toBe(false),
    );
  });

  it('lands a pending save on its own row even after an earlier row is removed out from under it', async () => {
    const d2 = deferred<ServiceRow>();
    const updateService = vi.fn((_r: string, _e: string, id: string) =>
      id === 's2' ? d2.promise : Promise.reject(new Error('unexpected updateService call')),
    );
    const deleteService = vi.fn().mockResolvedValue({});
    renderPanel({
      listServices: vi.fn().mockResolvedValue({
        items: [
          row({ id: 's1', title: 'Audit' }),
          row({ id: 's2', title: 'Coaching' }),
          row({ id: 's3', title: 'Design' }),
        ],
      }),
      updateService,
      deleteService,
    });
    await userEvent.type(await screen.findByLabelText('Service 2 title'), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Save service 2' }));
    await waitFor(() => expect(updateService).toHaveBeenCalledTimes(1));

    // Remove the EARLIER row while row 2's save is still in flight — this shifts every later
    // row's array position (and on-screen label) down by one.
    await userEvent.click(screen.getByRole('button', { name: 'Remove service 1' }));
    await waitFor(() => expect(deleteService).toHaveBeenCalledWith('r1', 'e1', 's1'));

    // What was "Service 2" (Coaching, still saving) is now "Service 1"; what was "Service 3"
    // (Design) is now "Service 2" and must come through untouched by row 2's late response.
    d2.resolve(row({ id: 's2', title: 'Coaching!' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save service 1' }).hasAttribute('disabled')).toBe(
        true,
      ),
    );
    expect(screen.getByLabelText('Service 1 title')).toHaveValue('Coaching!');
    expect(screen.getByLabelText('Service 2 title')).toHaveValue('Design');
  });

  it('reports clean on unmount, so a discarded pane cannot strand the exit guard', async () => {
    const { onDirtyChange, unmount } = renderPanel({
      listServices: vi.fn().mockResolvedValue({ items: [row()] }),
    });
    await userEvent.type(await screen.findByLabelText('Service 1 title'), '!');
    await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true));
    unmount();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });
});
