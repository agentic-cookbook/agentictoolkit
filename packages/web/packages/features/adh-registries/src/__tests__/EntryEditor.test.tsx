// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RegistryClient } from '@agentic-toolkit/registry/client';

// The editor mounts the real EntryPhotoField, which resolves an existing photo through a
// presigned download the moment its `value` is non-null. Stubbed rather than left real so the
// one test below that arrives with a photo does not depend on the network, and so that call is
// observable — it is the seam that proves `value` reached the field. `vi.hoisted` because
// vi.mock factories are lifted above every top-level declaration in the file.
const { authedJson } = vi.hoisted(() => ({ authedJson: vi.fn() }));
// `readAccessToken` is the toolkit cache's tenant lookup, reached through the services
// panel's cached list: null is a signed-out tenant, which is all these tests need it to be.
vi.mock('@agentic-toolkit/auth/client', () => ({
  authedJson,
  authedFetch: vi.fn(),
  readAccessToken: () => null,
}));

import { EntryEditor, saveBlock, type EntryEditorProps } from '../EntryEditor';
import { normalizeLinks } from '../links';

// See RegistryEditor.test.tsx: this repo's vitest config has no `test.globals`, so
// @testing-library/react's automatic cleanup never registers — wired explicitly here too.
// Without it, every test in this file (which each mount a full EntryEditor) leaves its
// "Save"/"Cancel" buttons and field controls in `document.body`, so the NEXT test's query
// finds its own elements plus every prior test's — a "found multiple elements" failure that
// has nothing to do with the code under test.
afterEach(cleanup);

const def = (over: Record<string, unknown>) => ({
  id: 'f', sectionId: 's1', key: 'k', type: 'text' as const, label: 'L', help: '',
  required: false, sortOrder: 0, config: {}, visibility: 'public', showIf: null, ...over,
});

const sections = [
  { id: 's1', key: 'about', label: 'About you', description: '', sortOrder: 0 },
  { id: 's2', key: 'work', label: 'Work', description: '', sortOrder: 1 },
];

const fieldDefs = [
  def({ id: 'f1', key: 'bio', label: 'Bio', required: true, sortOrder: 0 }),
  def({ id: 'f2', key: 'site', type: 'url' as const, label: 'Site', sortOrder: 1 }),
  def({ id: 'f3', key: 'rate', label: 'Rate', visibility: 'private', sortOrder: 2 }),
  def({ id: 'f4', sectionId: 's2', key: 'note', label: 'Note', sortOrder: 3 }),
];

const entry = {
  // `mike`, not `me`: `SLUG_RE` is `/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/`, so a two-character
  // slug is one the server has always refused. The old fixture only looked valid because
  // nothing on the client checked (R4-I1) — a fixture the server would 400 is a fixture that
  // proves the save path works on input no registrant can actually have.
  id: 'e1', registryId: 'r1', slug: 'mike', displayName: 'Me', summary: '',
  photoAttachmentId: null, providerType: 'person', category: '', keywords: [],
  locationText: '', countryCode: '', regionCode: '', geo: null, areaServed: {},
  deliveryMode: 'virtual', links: [], contactMode: 'dm', languages: [],
  status: 'draft', visibility: 'private',
  values: { bio: 'hello', note: 'kept' },
  // `site` starts narrowed by the REGISTRANT — `f2`'s def is `visibility: 'public'`, so the
  // ceiling admits all three and the picker is offered. `bio` deliberately has no entry: the
  // absent case (follow the def) is the common one and the save has to preserve it.
  valueVisibility: { site: 'authenticated' },
  createdAt: '2026-08-01 09:15:00',
};

// See RegistryEditor.test.tsx's `client()`: `as never` (the obvious cast for a partial mock)
// breaks under this repo's tsc — property access on `c.updateEntry` then errors "does not
// exist on type 'never'". Casting the finished object `as unknown as RegistryClient` fixes
// the client itself, but a test that needs the vi.fn() handle back (`.mock.calls`) can no
// longer recover it through the now-RegistryClient-typed property — those tests pass their
// own `updateEntry` in via `over` and assert against that named const instead.
const client = (over: Record<string, unknown> = {}) =>
  ({ updateEntry: vi.fn().mockResolvedValue(entry), ...over }) as unknown as RegistryClient;

/** Selection is driven through the URL seam, the same one PersonaEditor's tests use — a rail
 *  click is StackGroupDetail's behaviour, not this editor's, and it has its own tests. */
function renderEditor(over: Partial<EntryEditorProps> = {}, section?: string) {
  const props: EntryEditorProps = {
    registryId: 'r1',
    // The fixture's literal values (`providerType: 'person'`, `deliveryMode: 'virtual'`, …)
    // widen to `string` without a contextual type, so a direct cast narrows them back to
    // EntryRow's unions.
    entry: entry as EntryEditorProps['entry'],
    sections,
    fieldDefs: fieldDefs as EntryEditorProps['fieldDefs'],
    client: client(),
    activeSection: section,
    onSectionChange: vi.fn(),
    ...over,
  };
  return { ...render(<EntryEditor {...props} />), props };
}

describe('saveBlock', () => {
  // `keywords` and `languages` are here because `saveBlock` now bounds them (R4-I1's class fix)
  // — `entryWrite` caps both the item length and the set size server-side, and neither can be a
  // `maxLength` on a `TagSetField`.
  //
  // Typed against `saveBlock`'s own first-parameter type (`satisfies`, not a cast) rather than
  // a second, hand-copied `Pick<EntryRow, ...>` — one fixture the thirteen cases below override,
  // instead of thirteen separate annotations, and it can't drift from what `saveBlock` actually
  // accepts. `status: 'draft'` stays a literal narrow enough for `EntryStatus`, so every case
  // that spreads `base` without touching `status` still satisfies the union — only the cases
  // that override it (e.g. `status: 'published'`) are the ones exercising a different member.
  const base = {
    slug: 'mike', displayName: 'Me', status: 'draft', countryCode: '', links: [],
    keywords: [] as string[], languages: [] as string[],
  } satisfies Parameters<typeof saveBlock>[0];

  it('lets an ordinary draft through', () => {
    expect(saveBlock(base, [], null)).toBeNull();
  });

  it('names the topic holding the empty name or address', () => {
    expect(saveBlock({ ...base, displayName: '  ' }, [], null)?.topicId).toBe('identity');
    expect(saveBlock({ ...base, slug: '' }, [], null)?.topicId).toBe('identity');
  });

  it('does NOT block a draft save on a missing required answer', () => {
    // The split that makes independently-saveable sections possible: `required` gates
    // PUBLISH, not save, so a registrant can fill in one section and come back tomorrow.
    expect(saveBlock(base, [{ key: 'bio', label: 'Bio' }], null)).toBeNull();
  });

  it('blocks a PUBLISHED save while the checklist has entries, and counts them', () => {
    const one = saveBlock({ ...base, status: 'published' }, [{ key: 'bio', label: 'Bio' }], null);
    expect(one).toEqual({ message: 'Publishing needs 1 more answer.', topicId: 'publishing' });
    const two = saveBlock({ ...base, status: 'published' }, [
      { key: 'bio', label: 'Bio' },
      { key: 'site', label: 'Site' },
    ], null);
    expect(two?.message).toBe('Publishing needs 2 more answers.');
  });

  it('blocks a save on a country code that is not exactly two letters', () => {
    // Same defect class `normalizeLinks` exists for: `entryWrite.countryCode` is
    // `z.string().length(2).or(z.literal(''))` server-side, so a stray one-letter code 400s
    // the whole save — including every other section's answers — same as an empty link URL.
    expect(saveBlock({ ...base, countryCode: 'U' }, [], null)).toEqual({
      message: 'A country code is two letters — US, GB, DE.',
      topicId: 'reach',
    });
  });

  it('lets a blank country code through — it is the "not set yet" value', () => {
    expect(saveBlock({ ...base, countryCode: '' }, [], null)).toBeNull();
  });

  it('blocks a save on a link with a label but no address — it is mid-edit, not empty', () => {
    // The label-only row is exactly what normalizeLinks's docstring calls a row-in-progress —
    // dropping it silently would destroy what the registrant typed instead of saving it.
    expect(saveBlock({ ...base, links: [{ label: 'Portfolio', url: '' }] }, [], null)).toEqual({
      message: 'A link needs an address, not just a name.',
      topicId: 'reach',
    });
  });

  it('lets a fully blank link row through — normalizeLinks drops it, not saveBlock', () => {
    expect(saveBlock({ ...base, links: [{ label: '', url: '' }] }, [], null)).toBeNull();
  });

  it('blocks a link whose scheme is not http(s)', () => {
    // javascript:alert(1) is a valid URL to zod — the server's z.string().url() does not stop
    // this, so the editor has to.
    expect(
      saveBlock({ ...base, links: [{ label: 'x', url: 'javascript:alert(1)' }] }, [], null),
    ).toEqual({
      message: 'A link starts with http:// or https://.',
      topicId: 'reach',
    });
  });

  it('lets a bare host and an explicit https URL through', () => {
    expect(
      saveBlock(
        { ...base, links: [{ label: 'a', url: 'fishlamp.com' }, { label: 'b', url: 'https://x.dev' }] },
        [],
        null,
      ),
    ).toBeNull();
  });

  it('lets any slug through when the registry is not bound', () => {
    // Unbound, the entry slug is a SECOND path segment — registries.com/<registry>/<entry> —
    // and collides with nothing on that site.
    expect(saveBlock({ ...base, slug: 'about' }, [], null)).toBeNull();
  });

  it('refuses a slug that is a page on the bound site', () => {
    // Bound, the entry slug is a TOP-LEVEL segment on consultants.com, where /about is a real
    // page. Caught at save, because the alternative is a listing that resolves to someone
    // else's page and a registrant with no way to see why.
    const block = saveBlock({ ...base, slug: 'about' }, [], 'consultants');
    expect(block?.topicId).toBe('identity');
    expect(block?.message).toMatch(/already a page/);
  });

  it('allows an ordinary slug on a bound registry', () => {
    expect(saveBlock({ ...base, slug: 'mikefullerton' }, [], 'consultants')).toBeNull();
  });
});

describe('EntryEditor', () => {
  it('opens with nothing selected — picking a section is an explicit act', () => {
    renderEditor();
    expect(screen.getByText('Pick a section to fill in.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Bio')).toBeNull();
  });

  it('renders one control per live field def in the open section, in sort order', () => {
    renderEditor({}, 'section-s1');
    // FieldEditor (Task 4) appends a literal " *" to a required field's label — `bio` is the
    // one required def in this fixture, hence its `.textContent` carries the marker even
    // though the matcher itself matched on the label's own "Bio" text node.
    expect(screen.getAllByText(/^(Bio|Site|Rate|Note)$/).map((n) => n.textContent)).toEqual([
      'Bio *', 'Site', 'Rate',
    ]);
  });

  it('marks a private field as private, tied to its control via aria-describedby', () => {
    // A registrant who cannot tell public from private either withholds everything or
    // publishes something they meant to keep back — and only they can tell which. The note
    // itself is the weaker half of the fix: FieldEditor mints the control's id with useId()
    // and space-joins it into aria-describedby, which is the only reason a screen reader user
    // gets any hint at all. Asserting just `getByText` (as this used to) would stay green even
    // if that association were dropped, since an unassociated paragraph satisfies it too — see
    // EntrySectionPanel.tsx, which used to render exactly that unassociated duplicate.
    renderEditor({}, 'section-s1');
    const note = screen.getByText(/only the registry owner/i);
    const control = screen.getByLabelText('Rate');
    expect(control.getAttribute('aria-describedby')?.split(' ')).toContain(note.id);
  });

  it('leaves out a field whose show_if rule does not currently apply', () => {
    // The browser runs the same predicate the server runs, so the control a registrant never
    // saw is also the value the server never writes.
    renderEditor(
      {
        fieldDefs: [
          ...fieldDefs,
          def({ id: 'f5', key: 'why', label: 'Why', sortOrder: 4, showIf: { field: 'bio', op: 'eq', value: 'other' } }),
        ] as EntryEditorProps['fieldDefs'],
      },
      'section-s1',
    );
    expect(screen.queryByText('Why')).toBeNull();
  });

  it('neither sends nor validates a field whose show_if rule does not apply', async () => {
    // R4-I2. `save()` iterates `live`, not `ordered`, and the comment on `live` claims "what
    // renders, what validates and what gets sent all read THIS, so the three can never
    // disagree". Only *renders* was guarded — the test above asserts the control is absent,
    // and switching the save loop to `ordered` left all 112 tests green. Both of the other two
    // are separate production failures, so both are here:
    //
    //  * SENT — `why` holds a stale answer from a visit when the rule DID apply. Including it
    //    re-writes, on every save, an answer the registrant can no longer see or edit.
    //  * VALIDATED — that stale answer is not a valid URL any more. Validating a hidden field
    //    refuses the save and names a section holding no such control, so the registrant is
    //    told to fix something unreachable, forever.
    const updateEntry = vi.fn().mockResolvedValue(entry);
    const c = client({ updateEntry });
    renderEditor(
      {
        entry: {
          ...entry,
          values: { ...entry.values, why: 'not a url' },
        } as EntryEditorProps['entry'],
        fieldDefs: [
          ...fieldDefs,
          def({
            id: 'f5', key: 'why', type: 'url' as const, label: 'Why', sortOrder: 4,
            showIf: { field: 'bio', op: 'eq', value: 'other' },
          }),
        ] as EntryEditorProps['fieldDefs'],
        client: c,
      },
      'identity',
    );
    await userEvent.type(screen.getByLabelText(/display name/i), '!');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    // Reaching the call at all is the "not validated" half: a hidden field's bad value would
    // have stopped `save()` before the request.
    await waitFor(() => expect(updateEntry).toHaveBeenCalled());
    // Exact, not `not.toHaveProperty`: the absence of `why` is the point, and an exact map
    // also fails if the filter starts dropping keys it should be sending.
    expect(updateEntry.mock.calls[0]![2].values).toEqual({ bio: 'hello', note: 'kept' });
  });

  it('saves a draft with a required field still blank', async () => {
    // §13's "independently saveable sections": the registrant is mid-way through, and an
    // editor that refuses the save loses the work they HAVE done.
    const c = client();
    renderEditor({ entry: { ...entry, values: {} } as EntryEditorProps['entry'], client: c }, 'section-s1');
    await userEvent.type(screen.getByLabelText('Site'), 'https://example.com');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(c.updateEntry).toHaveBeenCalled());
  });

  it('blocks a malformed url and lets a valid one through', async () => {
    const c = client();
    renderEditor({ client: c }, 'section-s1');
    const site = screen.getByLabelText('Site');
    await userEvent.type(site, 'example.com');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(await screen.findByText(/http\(s\) URL/i)).toBeInTheDocument();
    expect(c.updateEntry).not.toHaveBeenCalled();

    await userEvent.clear(site);
    await userEvent.type(site, 'https://example.com');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(c.updateEntry).toHaveBeenCalled());
  });

  it('sends coerced values, not raw strings', async () => {
    // A TEXT field, not the boolean/checkbox field this test used to use: the checkbox
    // already emits a real boolean and `coerceFieldValue`'s boolean branch returns it
    // unchanged, so deleting `coerceFieldValue(def, raw)` from EntryEditor.tsx's save() and
    // substituting the raw value left that version of this test green too — it was the only
    // test of the save path's value transform, and it could not tell coercion apart from no
    // coercion at all. `coerceFieldValue`'s text branch trims (see
    // registry-types/src/validate.ts), so untrimmed whitespace survives ONLY when coercion
    // is actually skipped — a genuinely discriminating case. 'Rate' is `text`-typed, in the
    // open section, and not required, so no other assertion in this file depends on it.
    //
    // Passed in via `over` and asserted against directly — see `client()`'s comment: once
    // cast to RegistryClient, `c.updateEntry` no longer carries the vi.fn() `.mock` property.
    const updateEntry = vi.fn().mockResolvedValue(entry);
    const c = client({ updateEntry });
    renderEditor({ client: c }, 'section-s1');
    await userEvent.type(screen.getByLabelText('Rate'), '  hello  ');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(updateEntry).toHaveBeenCalled());
    const [, , body] = updateEntry.mock.calls[0]!;
    expect(body.values.rate).toBe('hello');
  });

  it('sends the WHOLE values map, not just the section that is open', async () => {
    // R4-I8. This used to say PATCH replaces `values` server-side, so a section sending only
    // its own keys would delete every other section's answers. That is not what the server
    // does — `mergePatch` (backend/src/adh/src/routes/registryEntries.ts) merges key by key,
    // so the other sections' answers survive a partial map on their own. What sending the map
    // whole actually buys is that the row ends up matching the editor on screen without this
    // component having to model which keys its own edits could have reached. `note` lives in
    // the CLOSED section s2, which is what makes it the assertion worth making.
    const updateEntry = vi.fn().mockResolvedValue(entry);
    const c = client({ updateEntry });
    renderEditor({ client: c }, 'section-s1');
    // Anchored, and not a substring match: `bio` is this fixture's one required field, so
    // FieldEditor appends a literal " *" to its accessible label — but a loose "Bio" also
    // matches the audience picker beside it, whose name is "Who can see this Bio".
    await userEvent.type(screen.getByLabelText(/^Bio \*$/), '!');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(updateEntry).toHaveBeenCalled());
    const [, , body] = updateEntry.mock.calls[0]!;
    expect(body.values).toEqual({ bio: 'hello!', note: 'kept' });
  });

  it('sends every spine column, not just the four identity owns', async () => {
    // §10's facets filter on these. A save that omits them writes a listing that no facet
    // can ever match, and nothing on screen says so.
    const updateEntry = vi.fn().mockResolvedValue(entry);
    const c = client({ updateEntry });
    renderEditor({ client: c }, 'identity');
    // `Field`'s hint renders INSIDE the same <label> as the caption (see field.tsx and
    // EntryReachPanel.test.tsx's 'writes the category leaf' comment), so this field's label
    // text is "One-line summary" plus its hint sentence with no separator — exact match fails.
    await userEvent.type(screen.getByLabelText('One-line summary', { exact: false }), '!');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(updateEntry).toHaveBeenCalled());
    expect(Object.keys(updateEntry.mock.calls[0]![2]).sort()).toEqual([
      'areaServed', 'category', 'contactMode', 'countryCode', 'deliveryMode', 'displayName',
      'keywords', 'languages', 'links', 'locationText', 'photoAttachmentId', 'providerType',
      'regionCode', 'slug', 'status', 'summary', 'valueVisibility', 'values', 'visibility',
    ]);
  });

  it('sends the audience the registrant chose, and keeps the ones they did not touch', async () => {
    // Two halves of the same column, and each fails on its own. The CHOSEN one is the feature:
    // a picker that changes nothing on the wire narrows a field on screen only. The UNTOUCHED
    // one is the regression: `note` lives in another section and its audience arrived from the
    // server, so an editor that sends only the keys it edited this session would quietly
    // re-widen every field the registrant narrowed on an earlier visit — the merge patch reads
    // an absent key as "leave alone", but this map is the stored one, not a delta.
    const updateEntry = vi.fn().mockResolvedValue(entry);
    const c = client({ updateEntry });
    renderEditor(
      {
        entry: {
          ...entry,
          valueVisibility: { site: 'authenticated', note: 'private' },
        } as EntryEditorProps['entry'],
        client: c,
      },
      'section-s1',
    );
    await userEvent.selectOptions(
      screen.getByLabelText(/who can see this site/i),
      'private',
    );
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(updateEntry).toHaveBeenCalled());
    expect(updateEntry.mock.calls[0]![2].valueVisibility).toEqual({
      site: 'private',
      note: 'private',
    });
  });

  it('offers no audience picker for a field the owner already scoped to themselves', async () => {
    // `rate`'s def is `visibility: 'private'`, so `visibilitiesWithin` yields one choice and
    // there is nothing to pick. Offering a one-option select would read as a decision the
    // registrant made, when the owner made it for them — and it would let a registrant think
    // they had widened a field that the server will never widen.
    renderEditor({}, 'section-s1');
    expect(screen.queryByLabelText(/who can see this rate/i)).toBeNull();
    expect(screen.getByLabelText(/who can see this site/i)).toBeInTheDocument();
  });

  it('sends the photo the registrant already has, not a hard-coded null', async () => {
    // Carried :1175. The key-set assertion above cannot see this one: every other fixture in
    // this file has `photoAttachmentId: null`, so hard-coding `null` into save()'s body keeps
    // that assertion (and the whole suite) green while silently dropping a chosen photo on
    // every subsequent save. This is the only test here whose entry arrives with a photo.
    authedJson.mockResolvedValue({ url: 'https://cdn.example/p.png' });
    const updateEntry = vi.fn().mockResolvedValue(entry);
    const c = client({ updateEntry });
    renderEditor(
      { client: c, entry: { ...entry, photoAttachmentId: 'att_1' } as EntryEditorProps['entry'] },
      'identity',
    );
    // The other half of the wiring: EntryIdentityPanel passes the draft's id DOWN as the photo
    // field's `value`, and that download call is the only observable proof it arrived.
    await waitFor(() => expect(authedJson).toHaveBeenCalledWith('/api/storage/downloads/att_1'));
    await userEvent.type(screen.getByLabelText('One-line summary', { exact: false }), '!');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(updateEntry).toHaveBeenCalled());
    expect(updateEntry.mock.calls[0]![2]).toMatchObject({ photoAttachmentId: 'att_1' });
  });

  it('sends links through normalizeLinks, not the raw draft', async () => {
    // The seam nothing else pins: normalizeLinks is unit-tested and the request body's key
    // set is tested by 'sends every spine column' above, but nothing proves save() actually
    // routes draft.links through the function before it goes on the wire.
    const updateEntry = vi.fn().mockResolvedValue(entry);
    const c = client({ updateEntry });
    renderEditor(
      {
        entry: {
          ...entry,
          links: [{ label: 'Site', url: 'fishlamp.com' }, { label: '', url: '' }],
        } as EntryEditorProps['entry'],
        client: c,
      },
      'identity',
    );
    await userEvent.type(screen.getByLabelText('One-line summary', { exact: false }), '!');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(updateEntry).toHaveBeenCalled());
    expect(updateEntry.mock.calls[0]![2].links).toEqual([
      { label: 'Site', url: 'https://fishlamp.com' },
    ]);
  });

  it('refuses to publish while the checklist still has entries, and says how many', async () => {
    const c = client();
    renderEditor(
      { entry: { ...entry, values: {} } as EntryEditorProps['entry'], client: c },
      'publishing',
    );
    await userEvent.selectOptions(screen.getByLabelText(/^status$/i), 'published');
    expect(screen.getByRole('status')).toHaveTextContent('Publishing needs 1 more answer.');
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
    expect(c.updateEntry).not.toHaveBeenCalled();
  });

  it('surfaces a server rejection instead of showing a saved form', async () => {
    const c = client({ updateEntry: vi.fn().mockRejectedValue(new Error('slug is taken')) });
    renderEditor({ client: c }, 'identity');
    await userEvent.type(screen.getByLabelText(/your address/i), 'x');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('slug is taken');
  });

  it('says nothing is wrong until there is an edit to be wrong about', async () => {
    // Minor `ee-leading-nodirty`. Dropping `&& dirty` from the header's leading slot left the
    // whole suite green, and the comment defending the conjunct was the only thing pinning it.
    // A registrant opening a listing they have not touched would be met with "Your listing
    // needs a name." — a complaint about a form they have not started, on arrival.
    renderEditor(
      { entry: { ...entry, displayName: '' } as EntryEditorProps['entry'] },
      'identity',
    );
    expect(screen.queryByRole('status')).toBeNull();
    // The SUMMARY box, not the name box: typing into the name would answer the complaint
    // instead of exposing it.
    await userEvent.type(screen.getByLabelText('One-line summary', { exact: false }), '!');
    expect(screen.getByRole('status')).toHaveTextContent('Your listing needs a name.');
  });

  it('warns before discarding unsaved edits', async () => {
    const onCancel = vi.fn();
    renderEditor({ onCancel }, 'identity');
    await userEvent.type(screen.getByLabelText(/display name/i), '!');
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(await screen.findByText('Discard unsaved changes?')).toBeInTheDocument();
  });

  it('folds a dirty service into the exit guard, so services are covered too', async () => {
    // F2: services save through their own routes, not the entry's `useDirtyDraft` — the one
    // seam this task exists for. Nothing else pins that `EntryServicesPanel`'s `onDirtyChange`
    // actually reaches `EntryEditor`'s own exit guard; reverting the guard's memo to plain
    // `dirty` would leave every other test in this file green.
    const onCancel = vi.fn();
    const c = client({
      listServices: vi.fn().mockResolvedValue({
        items: [
          {
            id: 's1', title: 'Audit', description: '', pricingModel: 'hourly',
            priceMin: 200, priceMax: null, currency: 'USD', unit: 'hour',
            deliveryMode: 'virtual', sortOrder: 0,
          },
        ],
      }),
    });
    renderEditor({ onCancel, client: c, servicesEnabled: true }, 'services');
    await userEvent.type(await screen.findByLabelText('Service 1 title'), '!');
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(onCancel).not.toHaveBeenCalled();
    expect(await screen.findByText('Discard unsaved changes?')).toBeInTheDocument();
  });

  it('clears its dirty state BEFORE handing control back', async () => {
    // §13's trap, and the reason `commit(saved)` runs before `onSaved`. An editor still dirty
    // at that moment makes its own exit guard veto the navigation its own save started: the
    // URL stays put, and a later reload 404s on a record that did save. Cancel goes through
    // the same gate, so it is what proves the state was cleared.
    const onCancel = vi.fn();
    const c = client();
    renderEditor({ onCancel, client: c }, 'identity');
    await userEvent.type(screen.getByLabelText(/display name/i), '!');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(c.updateEntry).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(onCancel).toHaveBeenCalled();
    expect(screen.queryByText('Discard unsaved changes?')).toBeNull();
  });

  it('has already adopted the saved row when it hands control to onSaved', async () => {
    // R4-I3. The test above proves dirty ends up clear; it never passes `onSaved`, so it
    // cannot see WHICH of the two ran first, and swapping `commit(saved)` with
    // `onSaved?.(saved)` left it green. Reading a dirty-derived signal from inside the spy
    // does not work either, and both reasons are worth writing down so nobody re-tries them:
    // the Save button is `disabled={!canSave || saving}` and `setSaving(false)` is in the
    // `finally`, so it reads "disabled" under both orders; and the two calls sit in ONE async
    // continuation, so React has batched the commit and not re-rendered by the time the spy
    // runs. `flushSync` cannot force it — under `act` the update is in React's act queue,
    // which `flushSync` does not drain.
    //
    // What DOES separate the two is a handler that never returns. That is not a contrivance:
    // `onSaved` is the navigation seam, and App Router navigation is implemented by throwing
    // (`redirect()` raises NEXT_REDIRECT). Under the shipped order the save is already
    // recorded when control leaves, so the editor is clean and showing the server's row —
    // note the SERVER's name, since `commit(saved)` adopts the response rather than the
    // draft. Under the swap, nothing was recorded: the listing is still dirty, still showing
    // what was typed, and the exit guard §13 warns about vetoes the navigation this save just
    // started.
    const onSaved = vi.fn(() => {
      throw new Error('onSaved navigated away');
    });
    const c = client({
      updateEntry: vi.fn().mockResolvedValue({ ...entry, displayName: 'Renamed by the server' }),
    });
    renderEditor({ onSaved, client: c }, 'identity');
    await userEvent.type(screen.getByLabelText(/display name/i), '!');
    await userEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(screen.getByLabelText<HTMLInputElement>(/display name/i).value)
      .toBe('Renamed by the server');
    // Cancel is the same gate §13's trap runs into, and it opens no prompt: clean.
    await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.queryByText('Discard unsaved changes?')).toBeNull();
  });
});

describe('normalizeLinks', () => {
  it('drops a row the registrant added but never filled in', () => {
    // One empty row would 400 the whole save — `url` is `z.string().url()` server-side —
    // taking every other section's answers down with it.
    expect(normalizeLinks([{ label: 'x', url: '  ' }])).toEqual([]);
  });

  it('adds the scheme a registrant meant', () => {
    expect(normalizeLinks([{ label: 'Site', url: 'fishlamp.com' }])).toEqual([
      { label: 'Site', url: 'https://fishlamp.com' },
    ]);
  });

  // R4 :1141. The name used to say "whatever the scheme", which over-promises to the next
  // reader: this function does leave any scheme alone, but `saveBlock`/`linkProblem` refuse
  // every scheme but http(s) before a link ever reaches it, so `mailto:` is not savable. The
  // unit's behaviour is right; only the claim about the product was too wide.
  it('leaves a URL that already has a scheme alone — prefixing is all it does', () => {
    expect(normalizeLinks([{ label: 'a', url: 'http://x.dev' }, { label: 'b', url: 'mailto:a@b.c' }])).toEqual([
      { label: 'a', url: 'http://x.dev' },
      { label: 'b', url: 'mailto:a@b.c' },
    ]);
  });
});
