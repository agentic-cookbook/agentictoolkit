// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ResourceTopic } from '@agentic-toolkit/resource';

// See RegistryEditor.test.tsx: this repo's vitest config has no `test.globals`, so
// @testing-library/react's automatic cleanup never registers — wired explicitly here too.
afterEach(cleanup);

vi.mock('../RegistryDetailsPanel', () => ({
  RegistryDetailsPanel: ({ title, onDeleted }: { title: string; onDeleted: () => void }) => (
    <div data-testid="details" data-title={title}>
      <button type="button" onClick={onDeleted}>deleted</button>
    </div>
  ),
}));
vi.mock('../RegistrySignupFormPanel', () => ({
  RegistrySignupFormPanel: ({ title }: { title: string }) => (
    <div data-testid="signup-form" data-title={title} />
  ),
}));
vi.mock('../RegistryPermissionsPanel', () => ({
  RegistryPermissionsPanel: ({ title }: { title: string }) => (
    <div data-testid="permissions" data-title={title} />
  ),
}));
vi.mock('../RegistryProvidersPanel', () => ({
  RegistryProvidersPanel: ({ title, registryId }: { title: string; registryId: string }) => (
    <div data-testid="providers" data-title={title} data-registry={registryId} />
  ),
}));
vi.mock('../PendingEntriesPanel', () => ({
  PendingEntriesPanel: ({ registryId }: { registryId: string }) => (
    <div data-testid="pending" data-registry={registryId} />
  ),
}));

import { registryTopics, type RegistryTopicContext } from '../registryTopics';
import type { RegistryDraftState, UseRegistryDraft } from '../useRegistryDraft';

const section = (over: Partial<RegistryDraftState['sections'][number]> = {}) => ({
  id: 's1', key: 'about', label: 'About', description: '', sortOrder: 0, ...over,
});

const draft = (over: Partial<RegistryDraftState> = {}): RegistryDraftState => ({
  registry: {
    id: 'r1', slug: 'coaches', name: 'Coaches', purpose: '', description: '',
    categoryRoot: '', entryTerm: 'coach', visibility: 'private', submissionPolicy: 'open',
    tags: [], servicesEnabled: false, boundSiteId: null,
  } as RegistryDraftState['registry'],
  sections: [section({ id: 's2', key: 'work', label: 'Work', sortOrder: 1 }), section()],
  fields: [],
  ...over,
});

const editor = (over: Partial<UseRegistryDraft> = {}): UseRegistryDraft => ({
  client: {} as UseRegistryDraft['client'],
  draft: draft(),
  error: null,
  saving: false,
  dirty: false,
  saveBlock: null,
  setRegistry: vi.fn(),
  setField: vi.fn(),
  addField: vi.fn(),
  deleteField: vi.fn(),
  moveField: vi.fn(),
  createSection: vi.fn(),
  deleteRegistry: vi.fn(),
  revert: vi.fn(),
  save: vi.fn(),
  ...over,
});

const ctx = (over: Partial<RegistryTopicContext> = {}): RegistryTopicContext => ({
  editor: editor(),
  registryId: 'r1',
  onDeleted: vi.fn(),
  ...over,
});

// The explorer hands `render` four arguments; these topics read the first two.
const pane = (topic: ResourceTopic) =>
  topic.render(
    'r1',
    (label) => `${label} (Coaches registry)`,
    { leafId: null, onSelect: () => {} },
    () => ({ leafId: null, onSelect: () => {} }),
  );

describe('registryTopics', () => {
  it('offers one topic per discrete thing an owner configures, then the people', () => {
    // The rail's whole job here is telling those things apart: the registry itself, the form
    // its registrants fill in, who may do either — and only then the people that produced,
    // as a roster and as the queue of decisions still owed.
    expect(registryTopics(ctx()).map((t) => t.id)).toEqual([
      'details',
      'signup-form',
      'permissions',
      'providers',
      'pending',
    ]);
  });

  it('divides the things configured from the people they produced', () => {
    // The divider is the rail's only statement that Providers and Submissions are not a
    // fourth and fifth setting. It sits after the last configuration topic, so a topic added
    // in the wrong half moves it — which is the failure this pins.
    const topics = registryTopics(ctx());
    expect(topics.filter((t) => t.dividerAfter).map((t) => t.id)).toEqual(['permissions']);
  });

  it('names every topic with a URL-safe, stable id', () => {
    // A topic id IS a path segment (`…/registries/<id>/signup-form`), so anything needing
    // percent-encoding would make the link the owner copies differ from the one they clicked.
    for (const topic of registryTopics(ctx())) {
      expect(topic.id).toMatch(/^[a-z0-9][a-z0-9-]*$/);
      expect(encodeURIComponent(topic.id)).toBe(topic.id);
    }
  });

  it('builds no topic per section', () => {
    // Sections used to be topics, which put the parts of one form at the same level of the
    // navigator as the registry's own settings. They are the Signup Form topic's body now, so
    // a stale `section-<id>` in someone's URL finds no topic at all rather than a lone
    // section's fields presented as a peer of Details.
    expect(registryTopics(ctx()).map((t) => t.id).filter((id) => id.startsWith('section-')))
      .toEqual([]);
  });

  it('keeps the same rail while the registry is still loading', () => {
    // `draft` is null until the first load lands. The topics are fixed, so the rail no longer
    // changes shape underneath the owner as sections arrive — each pane says "Loading…" on
    // its own instead.
    expect(registryTopics(ctx({ editor: editor({ draft: null }) })).map((t) => t.id)).toEqual([
      'details',
      'signup-form',
      'permissions',
      'providers',
      'pending',
    ]);
  });

  it('gives every editable topic the explorer’s own title', () => {
    const [details, signup, permissions] = registryTopics(ctx());
    render(<>{pane(details!)}{pane(signup!)}{pane(permissions!)}</>);
    expect(screen.getByTestId('details').dataset.title).toBe('Details (Coaches registry)');
    expect(screen.getByTestId('signup-form').dataset.title).toBe('Signup Form (Coaches registry)');
    expect(screen.getByTestId('permissions').dataset.title).toBe('Permissions (Coaches registry)');
  });

  it('hands the details pane the route’s own “the registry is gone” callback', () => {
    // Deleting is the one edit whose result is that the pane doing it no longer has a subject,
    // so leaving it cannot be the pane's own decision — the route owns the URL.
    const onDeleted = vi.fn();
    render(<>{pane(registryTopics(ctx({ onDeleted }))[0]!)}</>);
    fireEvent.click(screen.getByRole('button', { name: 'deleted' }));
    expect(onDeleted).toHaveBeenCalledOnce();
  });

  it('puts the standard editing bar over every editable topic', () => {
    // One Save per pane, over the ONE draft the hook holds — which is what lets an owner edit
    // the basics and the signup form in one pass and commit both.
    const peopleTopics = new Set(['providers', 'pending']);
    for (const topic of registryTopics(ctx()).filter((t) => !peopleTopics.has(t.id))) {
      const { unmount } = render(<>{pane(topic)}</>);
      expect(screen.getByRole('toolbar', { name: 'Editing actions' })).toBeInTheDocument();
      unmount();
    }
  });

  it('puts no editing bar over either list of people', () => {
    // Approving a listing, or removing a registrant, is its own request against its own row;
    // a Save bar over either would offer to commit a registry draft that has nothing to do
    // with the decision being made.
    for (const id of ['providers', 'pending']) {
      const { unmount } = render(<>{pane(registryTopics(ctx()).find((t) => t.id === id)!)}</>);
      expect(screen.getByTestId(id).dataset.registry).toBe('r1');
      expect(screen.queryByRole('toolbar')).toBeNull();
      unmount();
    }
  });

  it('gives the roster the explorer’s own title, and nothing at all with no registry open', () => {
    // Both halves are one decision: the panel loads by `registryId`, so a pane rendered
    // before one is chosen would fire a request against `undefined` — which is why the topic
    // returns null rather than a panel that copes.
    render(<>{pane(registryTopics(ctx()).find((t) => t.id === 'providers')!)}</>);
    expect(screen.getByTestId('providers').dataset.title).toBe('Providers (Coaches registry)');
    cleanup();

    const unopened = registryTopics(ctx({ registryId: undefined }));
    expect(pane(unopened.find((t) => t.id === 'providers')!)).toBeNull();
  });

  it('shows a load failure in place of the form, and a save failure beside it', () => {
    // The two halves of one `error`. A load that never produced a draft has no form to keep,
    // so the alert replaces the pane; a save failure must leave the owner's unsaved edits on
    // screen to fix and retry.
    const failedLoad = registryTopics(
      ctx({ editor: editor({ draft: null, error: 'registry not found' }) }),
    );
    const { unmount } = render(<>{pane(failedLoad[0]!)}</>);
    expect(screen.getByRole('alert')).toHaveTextContent('registry not found');
    expect(screen.queryByTestId('details')).toBeNull();
    unmount();

    const failedSave = registryTopics(ctx({ editor: editor({ error: 'slug is taken' }) }));
    render(<>{pane(failedSave[0]!)}</>);
    expect(screen.getByRole('alert')).toHaveTextContent('slug is taken');
    expect(screen.getByTestId('details')).toBeInTheDocument();
  });
});
