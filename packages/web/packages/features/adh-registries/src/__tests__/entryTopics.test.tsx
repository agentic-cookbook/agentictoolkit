// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { GroupTopicItem } from '@agentic-toolkit/resource';

// See RegistryEditor.test.tsx: this repo's vitest config has no `test.globals`, so
// @testing-library/react's automatic cleanup never registers — wired explicitly here too.
afterEach(cleanup);

vi.mock('../EntryIdentityPanel', () => ({
  EntryIdentityPanel: ({ entryTerm, entryId }: { entryTerm: string; entryId: string }) => (
    <div data-testid="identity" data-term={entryTerm} data-entry={entryId} />
  ),
}));
vi.mock('../EntrySectionPanel', () => ({
  EntrySectionPanel: ({ section, defs }: { section: { id: string }; defs: { key: string }[] }) => (
    <div data-testid="section" data-section={section.id} data-keys={defs.map((d) => d.key).join(',')} />
  ),
}));
vi.mock('../EntryPublishPanel', () => ({
  EntryPublishPanel: ({ blockers }: { blockers: { key: string }[] }) => (
    <div data-testid="publish" data-blockers={blockers.map((b) => b.key).join(',')} />
  ),
}));
vi.mock('../EntryReachPanel', () => ({
  EntryReachPanel: ({ categoryRoot }: { categoryRoot: string }) => (
    <div data-testid="reach" data-root={categoryRoot} />
  ),
}));
vi.mock('../EntryServicesPanel', () => ({
  EntryServicesPanel: ({ entryId }: { entryId: string }) => (
    <div data-testid="services" data-entry={entryId} />
  ),
}));

import { entryTopics, type EntryTopicContext } from '../entryTopics';

// `render` takes the deep-link sub-leaf, which these topics ignore. Derive the type from the
// signature rather than restating StackGroupDetail's internal shape.
const leaf = null as unknown as Parameters<GroupTopicItem['render']>[0];

const section = (over: Partial<EntryTopicContext['sections'][number]> = {}) => ({
  id: 's1', key: 'about', label: 'About you', description: '', sortOrder: 0, ...over,
});

const def = (over: Record<string, unknown> = {}) =>
  ({
    id: 'f1', sectionId: 's1', key: 'bio', type: 'text' as const, label: 'Bio', help: '',
    required: false, sortOrder: 0, config: {}, visibility: 'public', showIf: null, ...over,
  }) as EntryTopicContext['live'][number];

const ctx = (over: Partial<EntryTopicContext> = {}): EntryTopicContext => ({
  // A whole EntryRow, not the four-column stub the pre-reach fixture got away with: the
  // reach topic's panel reads `draft.links` and would throw on `undefined` the moment it
  // renders, and every test here renders every topic's panel via the mocks above.
  draft: {
    id: 'e1', registryId: 'r1', slug: 'me', displayName: 'Me', summary: '',
    photoAttachmentId: null, providerType: 'person', category: '', keywords: [],
    locationText: '', countryCode: '', regionCode: '', geo: null, areaServed: {},
    deliveryMode: 'virtual', links: [], contactMode: 'dm', languages: [],
    status: 'draft', visibility: 'private', values: {}, valueVisibility: {},
    createdAt: '2026-08-01 09:15:00',
  } as EntryTopicContext['draft'],
  set: vi.fn(),
  // Deliberately out of order: the rail sorts, the caller does not have to.
  sections: [section({ id: 's2', key: 'work', label: 'Work', sortOrder: 1 }), section()],
  live: [def(), def({ id: 'f2', sectionId: 's2', key: 'rate', label: 'Rate' })],
  values: {},
  errors: {},
  blockers: [],
  blockedTopicId: null,
  categoryRoot: 'software',
  entryTerm: 'consultant',
  onFieldChange: vi.fn(),
  onFieldVisibilityChange: vi.fn(),
  client: {} as EntryTopicContext['client'],
  registryId: 'r1',
  servicesEnabled: false,
  onServicesDirtyChange: () => {},
  ...over,
});

describe('entryTopics', () => {
  it('brackets the owner’s sections with the spine, in the owner’s order', () => {
    // Spec §13: spine sections first, owner-defined sections after. Publishing goes LAST
    // rather than beside identity, because its checklist means nothing until there are
    // answers to check.
    expect(entryTopics(ctx()).map((t) => t.id)).toEqual([
      'identity',
      'reach',
      'section-s1',
      'section-s2',
      'publishing',
    ]);
  });

  it('falls back to a section’s key when the owner left the label blank', () => {
    // A nameless rail row is unclickable in practice — the registrant cannot tell what it is.
    // Index 2: identity, reach, THIS section.
    expect(entryTopics(ctx({ sections: [section({ label: '' })] }))[2]!.label).toBe('about');
  });

  it('dots the section holding a missing required answer, and only that one', () => {
    // Without the dot a registrant has to open every section in turn to find what is missing.
    const topics = entryTopics(ctx({ blockers: [{ key: 'rate', label: 'Rate' }] }));
    expect(topics.map((t) => [t.id, t.blocked ?? false])).toEqual([
      ['identity', false],
      ['reach', false],
      ['section-s1', false],
      ['section-s2', true],
      ['publishing', false],
    ]);
  });

  it('dots the section holding an answer that failed validation, not only a missing one', () => {
    // R4-C2's second half. A value that fails validation in a section the registrant is not
    // looking at made Save do nothing at all — no message, no dot, nothing on screen pointing
    // anywhere. `rate` lives in s2, so the dot has to follow the field, not the open section.
    const topics = entryTopics(ctx({ errors: { rate: 'That is not a number.' } }));
    expect(topics.filter((t) => t.blocked).map((t) => t.id)).toEqual(['section-s2']);
  });

  // R4-I6. This was one assertion on `identity` alone, and hard-coding `blocked: false` on
  // either of the other two spine topics left the whole suite green — so two of the rail's
  // three spine destinations could silently stop dotting. Parameterised, because the property
  // is "the topic named by `blockedTopicId` is the one that dots", not a fact about identity.
  it.each(['identity', 'reach', 'publishing'])(
    'dots the %s topic when that is where the block is, and no other',
    (blockedTopicId) => {
      const topics = entryTopics(ctx({ blockedTopicId }));
      expect(topics.filter((t) => t.blocked).map((t) => t.id)).toEqual([blockedTopicId]);
    },
  );

  it('hands each section only its own live fields', () => {
    // The context is ONE object, so every panel's props have to be reachable from it. Get
    // this wrong and a section quietly renders another section's fields.
    const topics = entryTopics(ctx());
    render(
      <>
        {topics[2]!.render(leaf)}
        {topics[3]!.render(leaf)}
      </>,
    );
    expect(screen.getAllByTestId('section').map((p) => [p.dataset.section, p.dataset.keys])).toEqual([
      ['s1', 'bio'],
      ['s2', 'rate'],
    ]);
  });

  it('gives the spine the registry’s own word for a listing', () => {
    render(<>{entryTopics(ctx()).find((t) => t.id === 'identity')!.render(leaf)}</>);
    expect(screen.getByTestId('identity').dataset.term).toBe('consultant');
  });

  it('gives the identity topic the entry id the uploader needs', () => {
    render(<>{entryTopics(ctx()).find((t) => t.id === 'identity')!.render(leaf)}</>);
    expect(screen.getByTestId('identity').dataset.entry).toBe('e1');
  });

  it('gives the publishing topic the blocker list verbatim', () => {
    const blockers = [{ key: 'bio', label: 'Bio' }];
    render(<>{entryTopics(ctx({ blockers })).find((t) => t.id === 'publishing')!.render(leaf)}</>);
    expect(screen.getByTestId('publish').dataset.blockers).toBe('bio');
  });

  it('hands the reach topic the registry’s category root', () => {
    render(<>{entryTopics(ctx()).find((t) => t.id === 'reach')!.render(leaf)}</>);
    expect(screen.getByTestId('reach').dataset.root).toBe('software');
  });

  it('builds no services topic when the registry sells nothing', () => {
    // Not hidden — absent. A registry of career coaches should not have a pane whose every
    // control is about invoicing.
    expect(entryTopics(ctx()).map((t) => t.id)).not.toContain('services');
  });

  it('puts services between the owner’s sections and publishing', () => {
    expect(entryTopics(ctx({ servicesEnabled: true })).map((t) => t.id)).toEqual([
      'identity',
      'reach',
      'section-s1',
      'section-s2',
      'services',
      'publishing',
    ]);
  });

  it('gives the services topic the entry id, not the registry id', () => {
    const topics = entryTopics(ctx({ servicesEnabled: true }));
    render(<>{topics.find((t) => t.id === 'services')!.render(leaf)}</>);
    expect(screen.getByTestId('services').dataset.entry).toBe('e1');
  });
});
