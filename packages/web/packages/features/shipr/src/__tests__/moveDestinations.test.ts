import { describe, expect, it } from 'vitest';

import { moveDestinations } from '../toolbar/dialogs';
import type { NodeRef } from '../tree/levels';
import type { Group } from '../types';

/**
 * A folder as the backend actually sends one.
 *
 * `path` is built here the way the trigger builds it — an ancestry of IDS bracketed by
 * slashes — and deliberately NOT out of the names, because a fixture that let `path` read
 * as `fleet/marketing` is what let a sort by `path` look correct while it was really
 * ordering siblings by uuid.
 */
function group(
  id: string,
  parentId: string | null,
  name: string,
  position = 0,
): Group {
  const trail: string[] = [];
  for (let at: string | null = id; at; at = PARENTS.get(at) ?? null)
    trail.unshift(at);
  return {
    id,
    parentId,
    name,
    path: `/${trail.join('/')}/`,
    depth: trail.length - 1,
    position,
  };
}

/** Every parent edge the fixtures below use, so `group()` can build a real id ancestry. */
const PARENTS = new Map<string, string>([
  ['a1', 'a'],
  ['a2', 'a1'],
]);

const TREE: Group[] = [
  group('a', null, 'fleet'),
  group('a1', 'a', 'marketing'),
  group('a2', 'a1', 'sites'),
  group('b', null, 'tools'),
];

const g = (id: string): NodeRef => ({ kind: 'group', id });
const r = (id: string): NodeRef => ({ kind: 'repo', id });

describe('moveDestinations', () => {
  it('offers every folder when only repositories are moving', () => {
    expect(moveDestinations(TREE, [r('r1')]).map((x) => x.id)).toEqual([
      'a',
      'a1',
      'a2',
      'b',
    ]);
  });

  it('removes the moving folder itself', () => {
    expect(moveDestinations(TREE, [g('b')]).map((x) => x.id)).not.toContain('b');
  });

  it('removes descendants at every depth, not just the direct children', () => {
    // The grandchild is the case a single pass in row order would miss, and the database
    // refuses it — offering it would be a menu that lies.
    const ids = moveDestinations(TREE, [g('a')]).map((x) => x.id);
    expect(ids).toEqual(['b']);
  });

  it('finds a grandchild listed BEFORE its parent in the flat rows', () => {
    const scrambled = [
      group('a2', 'a1', 'sites'),
      group('a1', 'a', 'marketing'),
      group('a', null, 'fleet'),
    ];
    expect(moveDestinations(scrambled, [g('a')])).toEqual([]);
  });

  it('lists them in the rail’s order, parents before their children', () => {
    const scrambled = [
      group('a2', 'a1', 'sites'),
      group('b', null, 'tools'),
      group('a1', 'a', 'marketing'),
      group('a', null, 'fleet'),
    ];
    expect(moveDestinations(scrambled, []).map((x) => x.name)).toEqual([
      'fleet',
      'marketing',
      'sites',
      'tools',
    ]);
  });

  it('orders siblings by position and then name — never by the uuid in `path`', () => {
    // The bug this pins: `path` is an ID ancestry, so sorting by it puts siblings in
    // whatever order they drew from gen_random_uuid(). Here `zulu` sorts FIRST because an
    // operator dragged it there, which no comparator over `path` could ever say.
    const level = [
      group('id-aaa', null, 'alpha', 2000),
      group('id-zzz', null, 'zulu', 1000),
    ];
    expect(moveDestinations(level, []).map((x) => x.name)).toEqual([
      'zulu',
      'alpha',
    ]);
  });

  it('drops a folder whose parent is not in the rows — no root reaches it', () => {
    const orphan = [group('a', null, 'fleet'), group('x', 'missing', 'lost')];
    expect(moveDestinations(orphan, []).map((x) => x.name)).toEqual(['fleet']);
  });

  it('handles a mixed batch — the repositories place no restriction', () => {
    const ids = moveDestinations(TREE, [g('a1'), r('r1')]).map((x) => x.id);
    expect(ids).toEqual(['a', 'b']);
  });
});
