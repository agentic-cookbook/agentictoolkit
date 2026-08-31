import { describe, expect, it } from 'vitest';
import { parseRegistriesPath } from '../paths';

/**
 * The grammar, one URL shape per case. This is the part of the old
 * `RegistriesRoute.test.tsx` worth keeping: that file mocked three components and asserted
 * which one rendered, which tested the `if`-chain's *wiring* rather than the grammar — so the
 * chain could not be replaced without losing the only statement of what each URL means. Here
 * the grammar is asserted directly and survives whatever renders it.
 */
describe('parseRegistriesPath', () => {
  it('leaves the selection open for a bare feature path', () => {
    // Deliberately not `{ all: true }`: a bare path is "I did not say", which lets the
    // explorer resume the last registry. `/all` is "I said nothing is selected".
    expect(parseRegistriesPath(undefined)).toEqual({ kind: 'explorer' });
    expect(parseRegistriesPath([])).toEqual({ kind: 'explorer' });
  });

  it('reads /all as the explicit unselected state', () => {
    expect(parseRegistriesPath(['all'])).toEqual({ kind: 'explorer', all: true });
  });

  it('selects a registry and one of its topics', () => {
    expect(parseRegistriesPath(['r1'])).toEqual({
      kind: 'explorer',
      activeId: 'r1',
      activeTopic: undefined,
    });
    expect(parseRegistriesPath(['r1', 'details'])).toEqual({
      kind: 'explorer',
      activeId: 'r1',
      activeTopic: 'details',
    });
  });

  it('ignores anything past the topic', () => {
    // The explorer's grammar stops at the topic. It used to parse a fourth segment into
    // `ResourceExplorer`'s `activeLeafId`, but no registry topic is a master/detail that reads
    // one, so such a link rendered exactly as the three-segment link it was built from — a URL
    // level that silently does nothing, in the string people copy out of the address bar. This
    // asserts it is DROPPED rather than carried, so re-adding the level has to come with the
    // reader that gives it meaning.
    expect(parseRegistriesPath(['r1', 'signup-form', 'f9'])).toEqual({
      kind: 'explorer',
      activeId: 'r1',
      activeTopic: 'signup-form',
    });
  });

  it('reads joined/<id> as the registrant’s own listing', () => {
    // `joined` is a reserved first segment, so a registry whose id were literally "joined"
    // cannot shadow it — ids are uuids, and asserting the shape here is what keeps that true
    // if they ever stop being.
    expect(parseRegistriesPath(['joined', 'r1'])).toEqual({
      kind: 'joined',
      registryId: 'r1',
      section: undefined,
    });
    expect(parseRegistriesPath(['joined', 'r1', 'about'])).toEqual({
      kind: 'joined',
      registryId: 'r1',
      section: 'about',
    });
  });

  it('falls back to the explorer for a joined path that names no registry', () => {
    // The old route rendered its list here for the same reason: there is no editor to open
    // without an id, and an editor mounted on `undefined` would fetch nothing and say so
    // badly. Kept as its own case because it is the one arm of the grammar that is a
    // recovery rather than a meaning.
    expect(parseRegistriesPath(['joined'])).toEqual({ kind: 'explorer' });
  });
});
