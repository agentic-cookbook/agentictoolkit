// The pane's row ADDRESSING, pinned as its own unit.
//
// `MaskedProviderConfig.rdid` is `string | null` (the toolkit widened it from `string` so a
// missing address is unrepresentable as a usable one). Two of the seven reads in this pane were
// type errors and the compiler caught them; the other five compare or pass `rdid` in positions
// where `null` is perfectly legal to TypeScript and wrong at runtime. Those five are what this
// file exists for — a build that goes green proves nothing about them.
//
// Both helpers are exercised with rows whose `rdid` is null AND whose `id`s differ, because the
// whole failure mode is two DIFFERENT unmapped rows being read as one.
import { describe, expect, it } from 'vitest';
import type { MaskedProviderConfig } from '@agentic-toolkit/data/integrations';
import { addressOf, mergeFetchedRow } from './IntegrationsPane';

const cfg = (patch: Partial<MaskedProviderConfig>): MaskedProviderConfig => ({
  id: 'uuid-1',
  ecosystemId: 'eco-1',
  providerId: 'postmark',
  name: 'Postmark',
  rdid: 'integration.postmark.main',
  config: {},
  hasSecret: true,
  ...patch,
});

describe('addressOf', () => {
  it('uses the rdid when the row has one', () => {
    expect(addressOf(cfg({ rdid: 'integration.postmark.main', id: 'uuid-1' }))).toBe(
      'integration.postmark.main',
    );
  });

  // The fallback is the whole point: without it an unmapped row has no identity at all, and the
  // master/detail machine (getId), the React key, and `leaf.onSelect` are each handed a null
  // where a string is required.
  it('falls back to the uuid for a row with no canonical mapping', () => {
    expect(addressOf(cfg({ rdid: null, id: 'uuid-9' }))).toBe('uuid-9');
  });

  // Decorrelated on purpose: if `addressOf` returned the raw field, BOTH of these would be null
  // and this assertion is what tells them apart.
  it('gives two unmapped rows two different addresses', () => {
    const a = cfg({ rdid: null, id: 'uuid-a', name: 'A' });
    const b = cfg({ rdid: null, id: 'uuid-b', name: 'B' });
    expect(addressOf(a)).not.toBe(addressOf(b));
  });
});

describe('mergeFetchedRow', () => {
  it('adds the deep-linked row when the collection does not already carry it', () => {
    const inList = cfg({ id: 'uuid-1', rdid: 'integration.a', name: 'Alpha' });
    const fetched = cfg({ id: 'uuid-2', rdid: 'integration.b', name: 'Beta' });
    expect(mergeFetchedRow([inList], fetched).map((r) => r.id)).toEqual(['uuid-1', 'uuid-2']);
  });

  it('does not duplicate a row the collection already carries', () => {
    const row = cfg({ id: 'uuid-1', rdid: 'integration.a', name: 'Alpha' });
    expect(mergeFetchedRow([row], { ...row })).toHaveLength(1);
  });

  /**
   * THE `null === null` TRAP. Both rows are unmapped, so a raw-`rdid` comparison reads
   * `null === null` as "already present" and drops the deep-linked row on the floor — the pane
   * then renders a list that is missing the very instance the URL asked for, with no error
   * anywhere. Type-legal, silent, and impossible for `tsc` or `next build` to see.
   *
   * The list row and the fetched row deliberately share NO field value except the null rdid, so
   * nothing but that comparison can make them look like the same row.
   */
  it('keeps the deep-linked row when it and a list row are BOTH unmapped', () => {
    const unrelated = cfg({ id: 'uuid-list', rdid: null, name: 'Already listed' });
    const deepLinked = cfg({ id: 'uuid-deep', rdid: null, name: 'Deep linked' });

    const merged = mergeFetchedRow([unrelated], deepLinked);

    expect(merged.map((r) => r.id).sort()).toEqual(['uuid-deep', 'uuid-list']);
    // ...and it is addressable, which is what the master/detail machine will key it on.
    expect(merged.map(addressOf).sort()).toEqual(['uuid-deep', 'uuid-list']);
  });

  it('sorts by name so the row order does not depend on which fetch resolved first', () => {
    const zulu = cfg({ id: 'uuid-z', rdid: null, name: 'Zulu' });
    const alpha = cfg({ id: 'uuid-a', rdid: null, name: 'Alpha' });
    expect(mergeFetchedRow([zulu], alpha).map((r) => r.name)).toEqual(['Alpha', 'Zulu']);
  });

  it('returns the collection untouched when there is no fetched row', () => {
    const row = cfg({ id: 'uuid-1' });
    expect(mergeFetchedRow([row], null)).toEqual([row]);
  });
});
