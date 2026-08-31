// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RegistryClient } from '@agentic-toolkit/registry/client';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  // The base path is a PROP now, so nothing here reads `useParams` — it is kept because
  // `usePathname` and `useRouter` below are the pair `useBasePathRoute` actually uses, and a
  // partial next/navigation mock is the shape that has bitten this file before. The pushes
  // asserted below are all built off BASE.
  useParams: () => ({ workspace: 'mike' }),
  useRouter: () => ({ push }),
  usePathname: () => '/mike/registries/joined/r1',
}));

// A box rather than a closure over `let` — `vi.mock` hoists above every declaration in the
// file, same as `RegistriesFeature.test.tsx`.
const client: { current: Partial<RegistryClient> } = { current: {} };
vi.mock('../useRegistryClient', () => ({ useRegistryClient: () => client.current }));

// The REAL editor, wrapped to record what it was handed. Not a stub: the Cancel tests below
// have to run the editor's own exit gate, which is the thing the route was failing to connect
// to anything. What a stub would add is the one thing rendering cannot reach — `StackGroupDetail`
// publishes its rail into the workspace shell rather than into this subtree, so a rail click is
// not available here, and `onSectionChange` can only be exercised at the seam itself.
const seen: { current: Partial<EntryEditorProps> } = { current: {} };
vi.mock('../EntryEditor', async (importOriginal) => {
  const real = await importOriginal<typeof import('../EntryEditor')>();
  return {
    ...real,
    EntryEditor: (props: EntryEditorProps) => {
      seen.current = props;
      return <real.EntryEditor {...props} />;
    },
  };
});

import type { EntryEditorProps } from '../EntryEditor';
import { EntryEditorRoute } from '../EntryEditorRoute';

/** The hub's mount point, which is what every push assertion below is written against. */
const BASE = '/mike/registries';

/**
 * R4-I9, and the test half of R4-C1.
 *
 * This file did not exist. `EntryEditorRoute` is the SOLE production composition of
 * `EntryEditor`, every one of the editor's affordances that the route has to supply is an
 * OPTIONAL prop, and the editor's own tests supply them all — so 112 green tests described a
 * configuration that never shipped, and no typechecker was ever going to say so. Testing the
 * component and never the composition is the exact shape of gap C-1 fell through, which is why
 * these tests render the ROUTE.
 */

const registry = {
  id: 'r1', slug: 'coaches', name: 'Coaches', purpose: '', description: '',
  categoryRoot: 'coaching', entryTerm: 'coach', visibility: 'private',
  submissionPolicy: 'open', servicesEnabled: false, boundSiteId: null,
};

const entry = {
  id: 'e1', registryId: 'r1', slug: 'mike', displayName: 'Mike', summary: '',
  photoAttachmentId: null, providerType: 'person', category: '', keywords: [],
  locationText: '', countryCode: '', regionCode: '', geo: null, areaServed: {},
  deliveryMode: 'virtual', links: [], contactMode: 'dm', languages: [],
  status: 'draft', visibility: 'private', values: {}, valueVisibility: {},
};

const sections = [
  { id: 's1', key: 'about', label: 'About you', description: '', sortOrder: 0 },
  { id: 's2', key: 'work', label: 'Work', description: '', sortOrder: 1 },
];

const fieldDefs = [{
  id: 'f1', sectionId: 's1', key: 'bio', type: 'text', label: 'Bio', help: '',
  required: false, sortOrder: 0, config: {}, visibility: 'public', showIf: null,
}];

function renderRoute(over: Partial<RegistryClient> = {}, section?: string) {
  client.current = {
    getRegistry: vi.fn().mockResolvedValue(registry),
    myEntry: vi.fn().mockResolvedValue(entry),
    listSections: vi.fn().mockResolvedValue({ items: sections }),
    listFieldDefs: vi.fn().mockResolvedValue({ items: fieldDefs }),
    updateEntry: vi.fn().mockResolvedValue(entry),
    ...over,
  };
  return render(<EntryEditorRoute basePath={BASE} registryId="r1" section={section} />);
}

afterEach(() => {
  cleanup();
  push.mockReset();
  seen.current = {};
});

describe('EntryEditorRoute', () => {
  it('renders the editor once the entry and its form have loaded', async () => {
    renderRoute();
    expect(await screen.findByText('Pick a section to fill in.')).toBeInTheDocument();
    // The registry's own values reach the editor, not just the entry's — all four loads are
    // one `Promise.all`, and a rail that grows under the registrant is what that avoids.
    expect(seen.current.entryTerm).toBe('coach');
    expect(seen.current.sections).toHaveLength(2);
  });

  it('surfaces a load failure instead of loading forever', async () => {
    renderRoute({ myEntry: vi.fn().mockRejectedValue(new Error('forbidden')) });
    expect(await screen.findByRole('alert')).toHaveTextContent('forbidden');
  });

  it('opens the section named by the URL', async () => {
    // Deep-linking IN. The section id is the route's third segment, and `EntryEditor` only
    // honours it when the route passes BOTH `activeSection` and `onSectionChange` — passing
    // one alone leaves the rail on local selection and the URL inert.
    renderRoute({}, 'section-s1');
    expect(await screen.findByLabelText('Bio')).toBeInTheDocument();
    expect(seen.current.activeSection).toBe('section-s1');
  });

  it('puts the open section in the URL when the rail moves', async () => {
    // Deep-linking OUT, at the URL the route actually builds — a route that reads a segment it
    // never writes is a link nobody can produce. Both directions of the seam, because a null
    // selection has to SHORTEN the URL: a trailing empty segment is a fourth segment, and the
    // parser answers a fourth segment with the registry list.
    renderRoute({}, 'section-s1');
    await waitFor(() => expect(seen.current.onSectionChange).toBeDefined());
    seen.current.onSectionChange!('publishing');
    expect(push).toHaveBeenCalledWith('/mike/registries/joined/r1/publishing', { scroll: false });
    seen.current.onSectionChange!(null);
    expect(push).toHaveBeenCalledWith('/mike/registries/joined/r1', { scroll: false });
  });

  it('leaves the editor when Cancel is clicked on a clean listing', async () => {
    // R4-C1. Cancel used to call nothing at all in production: the registrant stayed exactly
    // where they were, on a screen they had just asked to leave.
    renderRoute();
    await userEvent.click(await screen.findByRole('button', { name: /cancel/i }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/mike/registries', { scroll: false }),
    );
  });

  it('asks before discarding edits, and leaves once the answer is Discard', async () => {
    // The gate is the editor's, but the thing it gates — actually going somewhere — is the
    // route's, and until this composition existed the prompt's "Discard" led back to the same
    // screen. `Stay` first, to prove the exit is genuinely gated rather than merely delayed.
    renderRoute({}, 'section-s1');
    await userEvent.type(await screen.findByLabelText('Bio'), 'hello');
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    await userEvent.click(await screen.findByRole('button', { name: /^stay$/i }));
    expect(push).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    await userEvent.click(await screen.findByRole('button', { name: /^discard$/i }));
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/mike/registries', { scroll: false }),
    );
  });
});
