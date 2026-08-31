// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RegistryClient } from '@agentic-toolkit/registry/client';

// A box rather than a closure over `let`: `vi.mock` is hoisted above every declaration in the
// file, so the factory cannot read a binding that is initialised further down.
const client: { current: Partial<RegistryClient> } = { current: {} };
vi.mock('../useRegistryClient', () => ({ useRegistryClient: () => client.current }));

import { CreateRegistryDialog } from '../CreateRegistryDialog';
import { registryPublicAddress } from '../publicAddress';

const onClose = vi.fn();
const onCreated = vi.fn();

afterEach(() => {
  cleanup();
  onClose.mockReset();
  onCreated.mockReset();
});

/**
 * The dialog on its own. It used to be a form the list expanded in place, which is why these
 * assertions were written against a "New registry" button and a "Create" one; the create
 * affordance is the explorer's now and the modal is the platform's shared one, so the button
 * that submits is its "Save". What each rule REFUSES, and the message it refuses with, is the
 * part that had to survive intact — a registry's slug is permanent after create.
 */
function renderDialog(over: Partial<RegistryClient> = {}) {
  client.current = { createRegistry: vi.fn(), ...over };
  return render(<CreateRegistryDialog onClose={onClose} onCreated={onCreated} />);
}

// `Field`'s hint renders inside the same <label>, so the accessible name is the caption plus
// the hint sentence — `exact: false` matches the "Web address" prefix.
const slugBox = () => screen.getByLabelText<HTMLInputElement>('Web address', { exact: false });

describe('CreateRegistryDialog', () => {
  it('proposes a slug from the name, and lets it be overridden', async () => {
    renderDialog();
    await userEvent.type(screen.getByLabelText('Name'), 'Career Coaches!');
    expect(slugBox().value).toBe('career-coaches');
    await userEvent.clear(slugBox());
    await userEvent.type(slugBox(), 'coaches');
    await userEvent.type(screen.getByLabelText('Name'), '?');
    // Once touched the slug stops following the name: it is permanent after create
    // (`registryUpdate` omits it), so a keystroke in a different box must not rewrite it.
    expect(slugBox().value).toBe('coaches');
  });

  it('accepts a hyphen typed directly into the slug box', async () => {
    // Regression (F3): the slug box's onChange ran the same `slugify` used to derive a slug
    // from the name, which strips a trailing dash on every keystroke. Typing "career-coaches"
    // passes through the intermediate state "career-" for one keystroke before the "c" lands
    // — stripping that dash immediately deletes it out from under the next character, so the
    // box never settles on "career-coaches" no matter how it's typed.
    const createRegistry = vi.fn().mockResolvedValue({ id: 'r_new', name: 'X' });
    renderDialog({ createRegistry });
    await userEvent.type(screen.getByLabelText('Name'), 'X');
    await userEvent.clear(slugBox());
    await userEvent.type(slugBox(), 'career-coaches');
    expect(slugBox().value).toBe('career-coaches');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(createRegistry).toHaveBeenCalledWith({ slug: 'career-coaches', name: 'X' }),
    );
  });

  it('refuses a slug that collides with a route on ANY site the registry could be bound to', async () => {
    const createRegistry = vi.fn();
    renderDialog({ createRegistry });
    await userEvent.type(screen.getByLabelText('Name'), 'Tour');
    // /tour is a real page. Caught here, where the owner can pick another one, rather than
    // after create when the slug is immutable. The message matched is the RULE — the check is
    // `isReservedSlugAnywhere`, an OR over every site's list, so a message naming one site
    // would be a reason that stops being true the day the lists diverge, which
    // `@agentic-toolkit/adh-registry` keeps them separate precisely to allow.
    expect(screen.getByText(/reserved page name/)).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(createRegistry).not.toHaveBeenCalled();
  });

  it('will not send a slug the server would refuse', async () => {
    const createRegistry = vi.fn();
    renderDialog({ createRegistry });
    // The server's message for a two-letter slug talks about characters, not length. Caught
    // here, the owner is told the actual rule.
    await userEvent.type(screen.getByLabelText('Name'), 'Ed');
    expect(screen.getByText(/at least three characters/)).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(createRegistry).not.toHaveBeenCalled();
  });

  it('rejects a trailing dash that would trim below the length minimum', async () => {
    // Collateral from F3 (re-review round 1): slugProblem() ran against the untrimmed box
    // value. "ab-" is 3 characters, so the local length gate passed and Save stayed
    // enabled — but create() submits the trimmed value, "ab" (2 characters), which the
    // server's SLUG_RE minimum rejects.
    const createRegistry = vi.fn();
    renderDialog({ createRegistry });
    await userEvent.type(screen.getByLabelText('Name'), 'Ab');
    await userEvent.clear(slugBox());
    await userEvent.type(slugBox(), 'ab-');
    expect(screen.getByText(/at least three characters/)).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(createRegistry).not.toHaveBeenCalled();
  });

  it('promises the same slug in the hint that it actually creates', async () => {
    // Collateral from F3 (re-review round 1): the hint and the reserved-slug check ran
    // against the untrimmed box value while create() submitted a trimmed one. "ab-cd-"
    // passes every local check, its hint promises the directory address of "ab-cd-", and what
    // actually gets created is "ab-cd" — a registry's slug is permanent after create, so the
    // owner would be shown one permanent address and silently given a different one.
    //
    // The expected address is BUILT with `registryPublicAddress`, not spelled out: this test is
    // about which slug the hint names, and hard-coding the host here would make it fail the day
    // the site's host changes for a reason it does not care about.
    const createRegistry = vi.fn().mockResolvedValue({ id: 'r_new', name: 'X' });
    renderDialog({ createRegistry });
    await userEvent.type(screen.getByLabelText('Name'), 'X');
    await userEvent.clear(slugBox());
    await userEvent.type(slugBox(), 'ab-cd-');
    expect(
      screen.getByText(`${registryPublicAddress('ab-cd')} — permanent, so choose it now.`),
    ).not.toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(createRegistry).toHaveBeenCalledWith({ slug: 'ab-cd', name: 'X' }));
  });

  it('hands the new registry back so the explorer can open it', async () => {
    const made = { id: 'r_new', name: 'Coaches' };
    const createRegistry = vi.fn().mockResolvedValue(made);
    renderDialog({ createRegistry });
    // Minor `rl-create-name-untrimmed`: `name.trim()` → `name` left the suite green. The
    // typed-with-spaces case is the ordinary one — a name pasted from anywhere carries them —
    // and the name is what the rail, the editor heading and every registry link display, so
    // an untrimmed one is visible on every screen this registry has.
    await userEvent.type(screen.getByLabelText('Name'), '  Coaches  ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(createRegistry).toHaveBeenCalledWith({ slug: 'coaches', name: 'Coaches' }),
    );
    // The row itself, not its id: the explorer awaits its own reload before routing, so what
    // it needs back is the record the list is about to contain.
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(made));
  });

  it('surfaces a duplicate slug from the server', async () => {
    const createRegistry = vi.fn().mockRejectedValue(new Error('slug already taken'));
    renderDialog({ createRegistry });
    await userEvent.type(screen.getByLabelText('Name'), 'Coaches');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('slug already taken')).not.toBeNull();
  });
});
