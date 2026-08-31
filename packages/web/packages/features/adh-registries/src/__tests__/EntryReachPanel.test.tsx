// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { EntryRow } from '@agentic-toolkit/registry/client';

// ONLY TagSetField is stubbed, and only because both of its halves are Base UI popovers
// that jsdom cannot open. `Field` and `FieldGroup` stay REAL — `Field` is what wraps each
// control in a <Label>, which is the entire reason getByLabelText finds these inputs.
vi.mock('@agenticdevelopertoolkit/ui/blocks', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@agenticdevelopertoolkit/ui/blocks')>()),
  TagSetField: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string[];
    onChange: (next: string[]) => void;
  }) => (
    <div>
      <span>{`${label}: ${value.join(',')}`}</span>
      <button type="button" onClick={() => onChange([...value, 'added'])}>
        {`add to ${label}`}
      </button>
    </div>
  ),
}));

import { EntryReachPanel } from '../EntryReachPanel';

const entry = (patch: Partial<EntryRow> = {}): EntryRow => ({
  id: 'e1', registryId: 'r1', slug: 'me', displayName: 'Me', summary: '',
  photoAttachmentId: null, providerType: 'person', category: '', keywords: [],
  locationText: '', countryCode: '', regionCode: '', geo: null, areaServed: {},
  deliveryMode: 'virtual', links: [], contactMode: 'dm', languages: [],
  status: 'draft', visibility: 'public', values: {}, valueVisibility: {},
  createdAt: '2026-08-01 09:15:00', ...patch,
});

function renderPanel(patch: Partial<EntryRow> = {}) {
  const set = vi.fn();
  render(<EntryReachPanel draft={entry(patch)} set={set} categoryRoot="software" />);
  return set;
}

afterEach(cleanup);

describe('EntryReachPanel', () => {
  it("names the registry's category root, so the leaf is written against it", () => {
    // The column stores the LEAF; the root is the registry's and the registrant never
    // retypes it. Without the root on screen there is no way to know what to write.
    renderPanel();
    expect(screen.getByText(/software/)).not.toBeNull();
  });

  it('writes the category leaf', async () => {
    const set = renderPanel();
    // `Field`'s hint renders INSIDE the same <label> as the caption (see field.tsx), so
    // dom-testing-library's label text is "Category" + the whole hint sentence concatenated
    // with no separator — an exact match against the caption alone can never find it. Same
    // reason `EntryEditor.test.tsx` queries `EntryIdentityPanel`'s hinted fields by regex
    // instead of an exact string.
    await userEvent.type(screen.getByLabelText('Category', { exact: false }), 'c');
    expect(set).toHaveBeenCalledWith('category', 'c');
  });

  it('adds a keyword', async () => {
    const set = renderPanel({ keywords: ['ios'] });
    await userEvent.click(screen.getByRole('button', { name: 'add to Keywords' }));
    expect(set).toHaveBeenCalledWith('keywords', ['ios', 'added']);
  });

  it('adds a language', async () => {
    const set = renderPanel({ languages: ['en'] });
    await userEvent.click(screen.getByRole('button', { name: 'add to Languages' }));
    expect(set).toHaveBeenCalledWith('languages', ['en', 'added']);
  });

  it('upper-cases the two codes on the way in', async () => {
    const set = renderPanel();
    // See the 'writes the category leaf' comment: all three of these fields carry a hint,
    // so their <label>'s text is the caption plus the hint sentence — exact matches fail.
    await userEvent.type(screen.getByLabelText('Where you are', { exact: false }), 'S');
    await userEvent.type(screen.getByLabelText('Country code', { exact: false }), 'u');
    await userEvent.type(screen.getByLabelText('State or region code', { exact: false }), 'w');
    expect(set).toHaveBeenCalledWith('locationText', 'S');
    // The facet filter compares the column exactly, so `us` and `US` would be two different
    // countries and a registrant who typed the lowercase one is invisible to both.
    expect(set).toHaveBeenCalledWith('countryCode', 'U');
    expect(set).toHaveBeenCalledWith('regionCode', 'W');
  });

  it('writes the delivery mode', async () => {
    const set = renderPanel();
    await userEvent.selectOptions(screen.getByLabelText('How you work'), 'hybrid');
    expect(set).toHaveBeenCalledWith('deliveryMode', 'hybrid');
  });

  it('turns contact off', async () => {
    const set = renderPanel();
    // See the 'writes the category leaf' comment: this field's hint puts the exact match
    // out of reach.
    await userEvent.selectOptions(screen.getByLabelText('How people reach you', { exact: false }), 'none');
    expect(set).toHaveBeenCalledWith('contactMode', 'none');
  });

  it('adds an empty link row', async () => {
    const set = renderPanel();
    await userEvent.click(screen.getByRole('button', { name: 'Add a link' }));
    expect(set).toHaveBeenCalledWith('links', [{ label: '', url: '' }]);
  });

  it('writes into an existing link row without touching its sibling', async () => {
    const set = renderPanel({
      links: [{ label: 'Site', url: 'https://a' }, { label: 'Repo', url: 'https://b' }],
    });
    await userEvent.type(screen.getByLabelText('Link 1 label'), 'X');
    expect(set).toHaveBeenCalledWith('links', [
      { label: 'SiteX', url: 'https://a' },
      { label: 'Repo', url: 'https://b' },
    ]);
  });

  it('removes a link row by position', async () => {
    const set = renderPanel({
      links: [{ label: 'A', url: 'https://a' }, { label: 'B', url: 'https://b' }],
    });
    await userEvent.click(screen.getByRole('button', { name: 'Remove link 1' }));
    expect(set).toHaveBeenCalledWith('links', [{ label: 'B', url: 'https://b' }]);
  });

  it('writes areaServed.text and leaves the rest of the object alone', async () => {
    const set = renderPanel({ areaServed: { text: '', radiusKm: 50 } });
    // See the 'writes the category leaf' comment: this field's hint puts the exact match
    // out of reach.
    await userEvent.type(screen.getByLabelText('Area you serve', { exact: false }), 'P');
    // `area_served` is a free-form JSON column (spec §4) and this row owns exactly one key
    // in it. Replacing the object would silently drop whatever else is in there.
    expect(set).toHaveBeenCalledWith('areaServed', { text: 'P', radiusKm: 50 });
  });
});
