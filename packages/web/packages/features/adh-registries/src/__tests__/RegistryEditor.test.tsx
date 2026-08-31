// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FieldDefRow, RegistryClient } from '@agentic-toolkit/registry/client';
import { registryTopics } from '../registryTopics';
import { useRegistryDraft } from '../useRegistryDraft';

// This repo's vitest config has no `test.globals`, so @testing-library/react's automatic
// cleanup (which only registers when it finds a GLOBAL `afterEach`) never fires — every
// component test file here wires it explicitly for the same reason.
afterEach(cleanup);

const registry = {
  id: 'r1', slug: 'coaches', name: 'Coaches', purpose: '', description: '',
  categoryRoot: 'coaching', entryTerm: 'coach', visibility: 'private',
  submissionPolicy: 'open', tags: [], servicesEnabled: false, boundSiteId: null,
};

// `as never` (the obvious cast for a partial mock) breaks under this repo's tsc: property access
// on `c.updateFieldDef` etc. then errors "does not exist on type 'never'". Casting the finished
// object `as unknown as RegistryClient` fixes the client itself, but any assertion that needs the
// vi.fn() handle back (`.mock.calls`, `toHaveBeenCalledWith`) still can't recover it through the
// now-RegistryClient-typed property — so callers that need one pass it in via `overrides` and keep
// their own named const to assert against, instead of reading it back off the client.
function client(overrides: Partial<RegistryClient> = {}): RegistryClient {
  return {
    getRegistry: vi.fn().mockResolvedValue(registry),
    updateRegistry: vi.fn().mockResolvedValue(registry),
    listSections: vi.fn().mockResolvedValue({
      items: [{ id: 's1', key: 'about', label: 'About', description: '', sortOrder: 0 }],
    }),
    createSection: vi.fn().mockResolvedValue({ id: 's2' }),
    listFieldDefs: vi.fn().mockResolvedValue({
      items: [{
        id: 'f1', sectionId: 's1', key: 'bio', type: 'text', label: 'Bio', help: '',
        required: false, sortOrder: 0, config: {}, visibility: 'public', showIf: null,
      }],
    }),
    createFieldDef: vi.fn().mockResolvedValue({ id: 'f2' }),
    updateFieldDef: vi.fn().mockResolvedValue({ id: 'f1' }),
    deleteFieldDef: vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    // Only the review-queue topic mounts it, and no test here opens that topic — but the
    // client is one object, so it carries the method its own tests override.
    listEntries: vi.fn().mockResolvedValue({ items: [] }),
    // Reached only from the Details pane's danger zone, which is collapsed until an owner
    // opens it — same reason as `listEntries` above: one client, every method on it.
    deleteRegistry: vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    ...overrides,
  } as unknown as RegistryClient;
}

// The key is a real slug rather than a one-letter placeholder because `draftBlock` now holds
// Save closed over an illegal one (`keyProblem`: three characters, the server's own SLUG_RE) —
// so a fixture key like `'k'` no longer describes a saveable draft, and every test that presses
// Save would be asserting against a button that is dead for a reason it never meant to test.
const fieldDef = (patch: Partial<FieldDefRow> = {}): FieldDefRow => ({
  id: 'f1', sectionId: 's1', key: 'field', type: 'text', label: 'L', help: '',
  required: false, sortOrder: 0, config: {}, visibility: 'public', showIf: null, ...patch,
});

const leaf = { leafId: null, onSelect: () => {} };

/**
 * The explorer, minus the explorer: ONE draft, the topics built from it, a rail of their
 * labels, and exactly ONE open pane — which is what production renders too, and what keeps
 * `getByRole('alert')` and `{ name: 'Save' }` unambiguous here.
 *
 * `ResourceExplorer` itself is the toolkit's, tested there; what these tests are about is the
 * behaviour the old builder owned and the panels now do — so the harness stands in for the
 * navigator and nothing else.
 */
function Editor({ client: c, topic }: { client: RegistryClient; topic: string }) {
  // The registries LIST's cache key — `basePath` in production. Any string will do here
  // (nothing in this harness reads that cache), but it is required, deliberately: the two
  // revalidation sweeps in the hook are silent when the key is wrong, so there is no value
  // that could stand in as a safe default.
  const editor = useRegistryDraft('r1', '/acme/registries', c);
  const topics = registryTopics({ editor, registryId: 'r1', onDeleted: () => {} });
  const [openId, setOpenId] = useState(topic);
  const open = topics.find((t) => t.id === openId);
  return (
    <>
      <nav aria-label="Sections">
        {topics.map((t) => (
          <button key={t.id} type="button" onClick={() => setOpenId(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      {open ? open.render('r1', (label) => label, leaf, () => leaf) : null}
    </>
  );
}

/** The registry's own basics — the pane an owner lands on. */
const renderDetails = (over: Partial<RegistryClient> = {}) =>
  render(<Editor client={client(over)} topic="details" />);

/**
 * The signup form: every section's field-def editor at once, with the preview beside it.
 *
 * Sections used to be topics of their own (`section-s1`), so this used to open one section.
 * They are the body of ONE topic now — the fixture has a single section, so what these tests
 * see is unchanged, and they still name the pane rather than the section.
 */
const renderSection = (over: Partial<RegistryClient> = {}) =>
  render(<Editor client={client(over)} topic="signup-form" />);

describe('the registry editor', () => {
  it('loads the registry, its sections and its fields', async () => {
    renderDetails();
    expect(await screen.findByDisplayValue('Coaches')).toBeInTheDocument();
    // The registry's own settings and the form its registrants fill in are different topics,
    // so the fields arrive through the rail rather than further down the same pane.
    await userEvent.click(await screen.findByRole('button', { name: 'Signup Form' }));
    expect(await screen.findByDisplayValue('Bio')).toBeInTheDocument();
  });

  it('locks key and type on a saved field and leaves them editable on a new one', async () => {
    renderSection();
    expect(await screen.findByDisplayValue('bio')).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: /add field/i }));
    const keys = await screen.findAllByLabelText(/^Key/);
    expect(keys[keys.length - 1]).not.toBeDisabled();
  });

  it('does not send key or type when saving an existing field', async () => {
    const updateFieldDef = vi.fn().mockResolvedValue({ id: 'f1' });
    renderSection({ updateFieldDef });
    const label = await screen.findByDisplayValue('Bio');
    await userEvent.clear(label);
    await userEvent.type(label, 'Biography');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(updateFieldDef).toHaveBeenCalled());
    const [, , body] = updateFieldDef.mock.calls[0]!;
    // The server ignores a key change and rejects a type change with a 400, so sending
    // either would turn an ordinary label edit into a failed save.
    expect(body).not.toHaveProperty('key');
    expect(body).not.toHaveProperty('type');
    expect(body.label).toBe('Biography');
  });

  it('adds a section', async () => {
    // Adding a section is adding a part to the signup form, so the control lives under the
    // form's own sections rather than among the registry's settings.
    const createSection = vi.fn().mockResolvedValue({ id: 's2' });
    renderSection({ createSection });
    await userEvent.click(await screen.findByRole('button', { name: /add section/i }));
    await userEvent.type(screen.getByLabelText(/section name/i), 'Experience');
    await userEvent.click(screen.getByRole('button', { name: /^create section$/i }));
    await waitFor(() =>
      expect(createSection).toHaveBeenCalledWith('r1', expect.objectContaining({ label: 'Experience' })),
    );
  });

  it('surfaces a save failure instead of showing a saved form', async () => {
    renderDetails({ updateRegistry: vi.fn().mockRejectedValue(new Error('slug is taken')) });
    const name = await screen.findByDisplayValue('Coaches');
    await userEvent.type(name, '!');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('slug is taken');
    // The form must SURVIVE a save failure, edits and all — this is what distinguishes the
    // `error && !draft` load-failure branch from a bare `if (error)`. Both satisfy the
    // assertion above; only the gated one leaves the user's unsaved work on screen. Without
    // this line the design choice is protected only incidentally, by the delete-rejection
    // test below, which happens to share the same `error` state.
    expect(screen.getByDisplayValue('Coaches!')).toBeInTheDocument();
  });

  it('sends categoryRoot when saving the registry', async () => {
    // Regression: updateRegistry's payload used to omit categoryRoot even though the input
    // above it is fully wired (value + onChange) — the owner could type a new root, Save
    // would enable and "succeed", and the next load() would snap it straight back.
    const updateRegistry = vi.fn().mockResolvedValue(registry);
    renderDetails({ updateRegistry });
    const name = await screen.findByDisplayValue('Coaches');
    await userEvent.type(name, '!');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(updateRegistry).toHaveBeenCalled());
    const [, body] = updateRegistry.mock.calls[0]!;
    expect(body.categoryRoot).toBe('coaching');
  });

  it('surfaces a load failure instead of hanging on Loading forever', async () => {
    // Regression: `if (!draft) return <p>Loading…</p>;` ran before the pane's only
    // role="alert", so a failed initial load (403/404/expired token) left `draft` null
    // forever and the error state had nowhere to render.
    renderDetails({ getRegistry: vi.fn().mockRejectedValue(new Error('registry not found')) });
    expect(await screen.findByRole('alert')).toHaveTextContent('registry not found');
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
  });

  it('keeps a field visible when deleting it is rejected', async () => {
    // Regression: the delete call was fire-and-forget (`void client.deleteFieldDef(...)`)
    // with the row removed from `draft` unconditionally right after — a rejected delete
    // (403, a stale registry) still made the row vanish immediately, with no alert, until
    // the next load() silently brought it back.
    const deleteFieldDef = vi.fn().mockRejectedValue(new Error('forbidden'));
    renderSection({ deleteFieldDef });
    await screen.findByDisplayValue('Bio');
    await userEvent.click(screen.getByRole('button', { name: /^Remove /i }));

    await waitFor(() => expect(deleteFieldDef).toHaveBeenCalled());
    expect(await screen.findByRole('alert')).toHaveTextContent('forbidden');
    expect(screen.getByDisplayValue('Bio')).toBeInTheDocument();
  });

  it('persists a field’s show_if rule on save', async () => {
    // F6 (review fix round 1): no test previously asserted that `showIf` actually reached
    // `updateFieldDef`'s body, even though the save loop names it explicitly.
    const updateFieldDef = vi.fn().mockResolvedValue({ id: 'f1' });
    renderSection({
      updateFieldDef,
      listFieldDefs: vi.fn().mockResolvedValue({
        items: [fieldDef({ id: 'f1', key: 'bio', showIf: { field: 'kind', op: 'eq', value: 'x' } })],
      }),
    });
    // Dirtied through the field's own label rather than the registry name: the two live in
    // different topics now, and this pane is the one the rule belongs to.
    await userEvent.type(await screen.findByDisplayValue('L'), '!');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => expect(updateFieldDef).toHaveBeenCalled());
    const [, , body] = updateFieldDef.mock.calls[0]!;
    expect(body.showIf).toEqual({ field: 'kind', op: 'eq', value: 'x' });
  });

  it('deleting a subject field clears its dependent’s rule WITHOUT a second request', async () => {
    // A rule can outlive the field it names: with "kind" gone, "detail"'s rule points at a key
    // nothing can ever answer, so "detail" silently disappears from every registrant's form.
    //
    // This used to be a `Promise.all` of one PATCH per dependent from here (F2's first fix).
    // That was wrong twice over — those PATCHes are separate requests, so a closed tab or a 403
    // between them left the rules dangling with nothing to clean them up, and each one
    // reindexes the WHOLE registry, so deleting a field with K dependents ran K+1 concurrent
    // full reindexes. DELETE /field-defs/:id now nulls every dependent rule in the same
    // transaction as the delete (F13), and this asserts BOTH halves of that move: no PATCH goes
    // out, and the form still updates without a reload.
    const deleteFieldDef = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const updateFieldDef = vi.fn().mockResolvedValue({ id: 'f2' });
    renderSection({
      deleteFieldDef,
      updateFieldDef,
      listFieldDefs: vi.fn().mockResolvedValue({
        items: [
          fieldDef({ id: 'f1', key: 'kind', label: 'Kind' }),
          fieldDef({
            id: 'f2', key: 'detail', label: 'Detail',
            showIf: { field: 'kind', op: 'eq', value: 'x' },
          }),
        ],
      }),
    });
    // "Detail" (not "Kind") to stay unambiguous: the dependent's own rule renders a "kind"
    // option inside a <select>, which getByDisplayValue would also match.
    await screen.findByDisplayValue('Detail');
    const removeButtons = await screen.findAllByRole('button', { name: /^Remove /i });
    await userEvent.click(removeButtons[0]!);

    await waitFor(() => expect(deleteFieldDef).toHaveBeenCalledWith('r1', 'f1'));
    // "detail" no longer has a rule — the stale "Only show this when kind" controls are gone.
    // (Not "offers Add a condition again": "kind" was "detail"'s only sibling, and it's the
    // one just deleted, so there is nothing left to condition on.)
    await waitFor(() => expect(screen.queryByLabelText('Only show this when')).toBeNull());
    // The server already did it. A PATCH here would be a redundant write that re-reindexes.
    expect(updateFieldDef).not.toHaveBeenCalled();
  });

  it('refuses to save silently when a field points at a section that no longer exists', async () => {
    // F5 (review fix round 1): the save loop iterates `draft.sections`, so a field whose
    // `sectionId` matches none of them was silently skipped — never created, never updated,
    // never reported. Make the failure loud instead. Asserted from the details pane, because
    // an orphaned field has no section topic to be visible in — which is precisely why the
    // save, not the form, has to be what says so.
    const updateRegistry = vi.fn().mockResolvedValue(registry);
    const updateFieldDef = vi.fn();
    const createFieldDef = vi.fn();
    renderDetails({
      updateRegistry,
      updateFieldDef,
      createFieldDef,
      listFieldDefs: vi.fn().mockResolvedValue({
        items: [fieldDef({ id: 'f1', sectionId: 'ghost' })],
      }),
    });
    const name = await screen.findByDisplayValue('Coaches');
    await userEvent.type(name, '!');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be saved/i);
    expect(updateRegistry).not.toHaveBeenCalled();
    expect(updateFieldDef).not.toHaveBeenCalled();
    expect(createFieldDef).not.toHaveBeenCalled();
  });
});

describe('the registry editor’s ordering', () => {
  it('moves a field down and persists the new positions', async () => {
    const updateFieldDef = vi.fn().mockImplementation((_r, id) => Promise.resolve({ id }));
    renderSection({
      updateFieldDef,
      listFieldDefs: vi.fn().mockResolvedValue({
        items: [
          fieldDef({ id: 'f1', key: 'alpha', sortOrder: 0 }),
          fieldDef({ id: 'f2', key: 'bravo', sortOrder: 1 }),
        ],
      }),
    });
    await userEvent.click((await screen.findAllByRole('button', { name: /Move down/ }))[0]!);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(updateFieldDef).toHaveBeenCalledTimes(2));
    // Positions are rewritten from the array, not incremented: two fields that both ended up
    // at 3 would render in whatever order the database felt like.
    const byId = Object.fromEntries(
      updateFieldDef.mock.calls.map((c) => [c[1], c[2].sortOrder as number]),
    );
    expect(byId).toEqual({ f1: 1, f2: 0 });
  });

  it('keeps an unsaved row matched to its own typed data when it is reordered', async () => {
    // F4 (review fix round 1): the row's React key used to be
    // `field.id ?? \`new-${draft.fields.indexOf(field)}\`` — an unsaved field's key was its
    // position in the flat field list, not an identity of its own. Moving a field changes
    // which array position everyone else in its section ends up at too (the whole section's
    // peers get spliced to the tail of `draft.fields`), so two unsaved rows can trade keys on
    // a single move — this is the same "index as identity" defect class as the earlier
    // reorder fixes on this branch, its third instance.
    renderSection({
      listFieldDefs: vi.fn().mockResolvedValue({
        items: [fieldDef({ id: 'f1', key: 'alpha', label: 'A', sortOrder: 0 })],
      }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Add field' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Add field' }));
    const labels = screen.getAllByLabelText('Label');
    // The first of the two new, unsaved rows gets a typed-but-unsaved label.
    await userEvent.type(labels[1]!, 'Draft label');
    const moveUps = screen.getAllByRole('button', { name: /Move up/ });
    // Move the SECOND new row up, past the one just typed into.
    await userEvent.click(moveUps[moveUps.length - 1]!);
    // Identity, not value: `user-event`'s click() focuses the clicked button. Under the old
    // index-derived key, reconciliation leaves that DOM node in place and overwrites its
    // props, so the still-focused button would end up labeled for whatever field the index
    // now belongs to — a value-only assertion below can't see that, because a mis-keyed
    // reconciliation still lands the right prop *values* on every node. Under the clientKey
    // fix, React relocates the subtree with the field it belongs to, so the focused node
    // keeps its own field's label. The row clicked here is still empty (never typed into), so
    // its own label stays 'field'.
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Move up field');
    expect(screen.getByDisplayValue('Draft label')).toBeInTheDocument();
    // And it must still be a genuinely empty row, not "Draft label" duplicated onto it by a
    // key collision.
    const remainingLabels = screen.getAllByLabelText<HTMLInputElement>('Label');
    expect(remainingLabels.filter((l) => l.value === '')).toHaveLength(1);
  });

  it('creates a new field at the end of its section', async () => {
    const createFieldDef = vi.fn().mockResolvedValue(fieldDef({ id: 'f9' }));
    renderSection({
      createFieldDef,
      listFieldDefs: vi.fn().mockResolvedValue({ items: [fieldDef({ id: 'f1', sortOrder: 0 })] }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Add field' }));
    await userEvent.type(screen.getAllByLabelText(/^Key/)[1]!, 'new');
    await userEvent.type(screen.getAllByLabelText('Label')[1]!, 'New');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(createFieldDef).toHaveBeenCalled());
    expect(createFieldDef.mock.calls[0]![1]).toMatchObject({ sortOrder: 1 });
  });

  it('writes a new field’s position from where it now sits, not where it was added', async () => {
    // Minor `rb-create-sortorder`. The test above cannot see this one: a field added to a
    // one-field section is minted with `sortOrder: 1` AND lands at index 1, so dropping
    // `sortOrder: index` from the create body left the whole suite green. Moving the new row
    // up separates the two — `move()` reorders the array and deliberately does not rewrite
    // `sortOrder`, because assigning positions is the save's job. Without the index, the
    // owner's new field renders in one place in the editor and another for every registrant.
    const createFieldDef = vi.fn().mockResolvedValue(fieldDef({ id: 'f9' }));
    const updateFieldDef = vi.fn().mockImplementation((_r, id) => Promise.resolve({ id }));
    renderSection({
      createFieldDef,
      updateFieldDef,
      listFieldDefs: vi.fn().mockResolvedValue({ items: [fieldDef({ id: 'f1', sortOrder: 0 })] }),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Add field' }));
    await userEvent.type(screen.getAllByLabelText(/^Key/)[1]!, 'new');
    await userEvent.type(screen.getAllByLabelText('Label')[1]!, 'New');
    const moveUps = screen.getAllByRole('button', { name: /Move up/ });
    await userEvent.click(moveUps[moveUps.length - 1]!);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(createFieldDef).toHaveBeenCalled());
    expect(createFieldDef.mock.calls[0]![1]).toMatchObject({ sortOrder: 0 });
    // The other half of the same statement: the existing field takes the position it was
    // pushed into. Asserting only the new one leaves "both at 0" green.
    expect(updateFieldDef.mock.calls[0]![2]).toMatchObject({ sortOrder: 1 });
  });
});

describe('the registry editor’s saving', () => {
  it('keeps Save dead until something has actually changed', async () => {
    // Minor `rb-save-disabled`. Dropping `!dirty` from the button left the suite green. A
    // live Save on an untouched editor re-writes the registry, every section and every field
    // def — one serialized round trip per field — over rows the owner never touched, and the
    // dead button is the only thing on this screen that says whether there is work to save.
    renderDetails();
    expect(await screen.findByRole('button', { name: 'Save' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Name'), '!');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('gives the owner a way back out of edits they have not saved', async () => {
    // The other half of the platform's standard editing bar, which the old builder never had:
    // a Save with no Cancel leaves an owner who typed into the wrong registry no way to undo
    // it but to retype the original from memory. Cancel is dead until there is something to
    // throw away, for the same reason Save is.
    renderDetails();
    expect(await screen.findByRole('button', { name: 'Cancel' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Name'), '!');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByLabelText<HTMLInputElement>('Name').value).toBe('Coaches');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });
});

describe('the registry editor’s preview', () => {
  // The shared setup declares a 768px viewport (vitest.setup.ts), which is under the control's
  // 64rem split breakpoint — so the pane is in its narrow, TABBED layout here: one of
  // Edit/Preview on screen at a time, chosen by the pair of toggles above them. The split layout
  // is the same two panes side by side, so what these tests assert about the preview holds in
  // both; the describe below walks the wide branch itself.
  const showPreview = () =>
    userEvent.click(screen.getByRole('button', { name: 'Preview' }));

  it('renders the form the owner is building, as a registrant would see it', async () => {
    renderSection({
      listFieldDefs: vi.fn().mockResolvedValue({
        items: [fieldDef({ id: 'f1', key: 'bio', label: 'Your bio' })],
      }),
    });
    await screen.findByDisplayValue('Your bio');
    await showPreview();
    expect(screen.getByLabelText('Your bio')).not.toBeNull();
  });

  it('honours a show_if rule against the preview’s own answers', async () => {
    renderSection({
      listFieldDefs: vi.fn().mockResolvedValue({
        items: [
          fieldDef({ id: 'f1', key: 'kind', label: 'Kind' }),
          fieldDef({
            id: 'f2', key: 'detail', label: 'Detail',
            showIf: { field: 'kind', op: 'eq', value: 'ios' },
          }),
        ],
      }),
    });
    await screen.findByDisplayValue('Detail');
    await showPreview();
    expect(screen.queryByLabelText('Detail')).toBeNull();
    await userEvent.type(screen.getByLabelText('Kind'), 'ios');
    // The point of the preview: the owner sees their own rule fire without publishing and
    // filling in a real entry to test it.
    expect(await screen.findByLabelText('Detail')).not.toBeNull();
  });

  it('keeps the preview’s answers across a switch back to the editor', async () => {
    // One form, one set of answers — so a rule the owner is checking survives the trip to the
    // editor and back. This is what the split layout makes obvious and the tabbed one has to
    // promise: in the split both panes are on screen at once, and answers that reset every
    // time the editor took focus would be answers that never reach a rule at all.
    renderSection({
      listFieldDefs: vi.fn().mockResolvedValue({ items: [fieldDef({ id: 'f1', key: 'bio', label: 'Bio' })] }),
    });
    await screen.findByDisplayValue('Bio');
    await showPreview();
    await userEvent.type(screen.getByLabelText('Bio'), 'typed');
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await showPreview();
    expect(screen.getByLabelText<HTMLInputElement>('Bio').value).toBe('typed');
  });

  it('never lets a preview answer reach the draft the owner saves', async () => {
    // Preview answers are nobody's entry — they are thrown away with the pane, and until then
    // they are not an edit. Typing one must neither arm Save nor be carried to the server: the
    // owner filling in their own form to test it is not the owner writing a registrant's row.
    const updateFieldDef = vi.fn().mockResolvedValue({ id: 'f1' });
    const { unmount } = renderSection({
      updateFieldDef,
      listFieldDefs: vi.fn().mockResolvedValue({ items: [fieldDef({ id: 'f1', key: 'bio', label: 'Bio' })] }),
    });
    await screen.findByDisplayValue('Bio');
    await showPreview();
    await userEvent.type(screen.getByLabelText('Bio'), 'typed');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    // And they do not outlive the pane: reopening the topic starts from an empty form.
    unmount();
    renderSection({
      listFieldDefs: vi.fn().mockResolvedValue({ items: [fieldDef({ id: 'f1', key: 'bio', label: 'Bio' })] }),
    });
    await screen.findByDisplayValue('Bio');
    await showPreview();
    expect(screen.getByLabelText<HTMLInputElement>('Bio').value).toBe('');
  });
});

describe('the signup form at a desktop width', () => {
  // The other half of the responsive control. Everything above runs narrow, because the shared
  // setup's `matchMedia` answers `matches: false` to every query; these two say yes instead.
  //
  // Stubbed PER FILE rather than by moving the viewport, which is what this did until the feature
  // left the hub on 2026-08-31: the hub app's own `vitest.setup.ts` carries a `matchMedia` that
  // parses width features and answers them from a declared `window.innerWidth`, so `goWide()`
  // there was enough. No such shim exists under `packages/web`, so a `window.innerWidth = 1440`
  // here moved a number nothing reads and both tests failed looking for a control the narrow
  // branch never renders. A per-file stub is also the convention the control's OWN test follows
  // (`@agenticdevelopertoolkit/ui`'s splitViewControl.test.tsx), which is what makes it portable:
  // it asks nothing of the host that mounts the suite.
  const original = window.matchMedia;
  afterEach(() => {
    window.matchMedia = original;
  });

  const goWide = () => {
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
  };

  it('offers the layout choice once there is room for two columns', async () => {
    goWide();
    renderSection();
    await screen.findByDisplayValue('Bio');
    // Absent at 768px — two half-width columns of a form on a phone are unreadable, so the
    // control drops the choice rather than offering one that would make the pane worse.
    expect(screen.getByRole('group', { name: 'Form layout' })).toBeInTheDocument();
  });

  it('puts the builder and the preview on screen together in the split', async () => {
    goWide();
    renderSection({
      listFieldDefs: vi.fn().mockResolvedValue({
        items: [fieldDef({ id: 'f1', key: 'bio', label: 'Bio' })],
      }),
    });
    await screen.findByDisplayValue('Bio');
    await userEvent.click(screen.getByRole('button', { name: 'Side by side view' }));

    // The field the owner is editing and the field a registrant would fill in, at once — which
    // is the whole point of the split, and what the tabbed tests above can only approximate by
    // switching back and forth.
    expect(screen.getByDisplayValue('Bio')).toBeInTheDocument();
    expect(screen.getByLabelText('Bio')).toBeInTheDocument();
    // With both panes mounted, a pane chooser would be a control with nothing to choose.
    expect(screen.queryByRole('group', { name: 'Form pane' })).toBeNull();
  });
});
