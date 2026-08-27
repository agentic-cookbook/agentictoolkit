import { describe, expect, it } from 'vitest';

import {
  childGroups,
  descendantsOf,
  pathToGroup,
  planLevels,
  reposIn,
} from '../tree/levels';
import type { Group, RepoItem } from '../types';

function group(
  id: string,
  parentId: string | null,
  name: string,
  position = 0,
): Group {
  return { id, parentId, name, path: name, depth: 0, position };
}

function repo(
  id: string,
  groupId: string | null,
  slug: string,
  shard = 'all',
  position = 0,
): RepoItem {
  return {
    id,
    devRepoId: `dev-${id}`,
    groupId,
    slug,
    shard,
    shipBranch: 'ship',
    ciContext: 'gate',
    envBranches: {},
    registeredAt: null,
    position,
    devRepo: null,
    state: null,
  };
}

describe('childGroups', () => {
  it('sorts by position, then breaks ties by name', () => {
    const groups = [
      group('c', null, 'charlie', 2000),
      group('b', null, 'bravo', 1000),
      group('a', null, 'alpha', 1000),
    ];
    expect(childGroups(groups, null).map((g) => g.id)).toEqual(['a', 'b', 'c']);
  });

  it('lists only the direct children of the folder asked for', () => {
    const groups = [group('a', null, 'alpha'), group('a1', 'a', 'inner')];
    expect(childGroups(groups, 'a').map((g) => g.id)).toEqual(['a1']);
  });
});

describe('reposIn', () => {
  it('breaks a position tie by slug, then by shard', () => {
    // Two mirrors of one repository differ ONLY in the shard, so a comparator that stopped
    // at the slug would leave them ordered by whatever Postgres returned.
    const items = [
      repo('2', null, 'me/site', 'web'),
      repo('1', null, 'me/site', 'api'),
      repo('0', null, 'me/aaa', 'all'),
    ];
    expect(reposIn(items, null, []).map((r) => r.id)).toEqual(['0', '1', '2']);
  });

  it('surfaces a repository whose folder the caller cannot see at the root', () => {
    // A per-repository grant does not imply a grant on the folder's ancestors, so the
    // folder can be absent from the tree while the repository is present. Dropping the row
    // would hide exactly the repository the grant exists to expose.
    const items = [repo('r1', 'unreachable', 'me/site')];
    expect(reposIn(items, null, []).map((r) => r.id)).toEqual(['r1']);
  });

  it('does not surface it at the root once its folder IS visible', () => {
    const groups = [group('g', null, 'fleet')];
    const items = [repo('r1', 'g', 'me/site')];
    expect(reposIn(items, null, groups)).toEqual([]);
    expect(reposIn(items, 'g', groups).map((r) => r.id)).toEqual(['r1']);
  });
});

describe('planLevels', () => {
  const groups = [
    group('a', null, 'fleet'),
    group('a1', 'a', 'marketing'),
    group('b', null, 'tools'),
  ];
  const items = [repo('r1', 'a1', 'me/site'), repo('r2', null, 'me/loose')];

  it('always returns the root rail, even with an empty tree', () => {
    const levels = planLevels({ tree: { groups: [], items: [] }, path: [] });
    expect(levels).toHaveLength(1);
    expect(levels[0]!.id).toBe('shipr-root');
    expect(levels[0]!.groupId).toBeNull();
  });

  it('returns one rail per opened folder, plus the folder itself', () => {
    const levels = planLevels({ tree: { groups, items }, path: ['a', 'a1'] });
    expect(levels.map((l) => l.id)).toEqual([
      'shipr-root',
      'shipr-group-a',
      'shipr-group-a1',
    ]);
    expect(levels[2]!.repos.map((r) => r.id)).toEqual(['r1']);
  });

  it('marks the opened folder as the selection of the rail it lives on', () => {
    const levels = planLevels({ tree: { groups, items }, path: ['a'] });
    expect(levels[0]!.selected).toEqual({ kind: 'group', id: 'a' });
    expect(levels[1]!.selected).toBeNull();
  });

  it('truncates on a folder that was deleted while it was open', () => {
    const levels = planLevels({
      tree: { groups, items },
      path: ['a', 'gone'],
    });
    expect(levels.map((l) => l.id)).toEqual(['shipr-root', 'shipr-group-a']);
  });

  it('truncates on a folder that was MOVED out from under the path', () => {
    // `a1` still exists, but no longer under `a` — so the rail we are on is not its parent.
    const moved = [group('a', null, 'fleet'), group('a1', 'b', 'marketing'), group('b', null, 'tools')];
    const levels = planLevels({ tree: { groups: moved, items }, path: ['a', 'a1'] });
    expect(levels.map((l) => l.id)).toEqual(['shipr-root', 'shipr-group-a']);
  });

  it('selects a repository only on the rail it is filed in', () => {
    const levels = planLevels({
      tree: { groups, items },
      path: ['a', 'a1'],
      selectedRepoId: 'r1',
    });
    expect(levels[0]!.selected).toEqual({ kind: 'group', id: 'a' });
    expect(levels[2]!.selected).toEqual({ kind: 'repo', id: 'r1' });
  });

  it('uses the caller-supplied root title for the outermost rail', () => {
    const levels = planLevels({
      tree: { groups, items },
      path: [],
      rootTitle: 'Acme',
    });
    expect(levels[0]!.title).toBe('Acme');
  });
});

describe('pathToGroup', () => {
  it('walks parentId outward and returns the chain outermost first', () => {
    const groups = [
      group('a', null, 'fleet'),
      group('a1', 'a', 'marketing'),
      group('a2', 'a1', 'sites'),
    ];
    expect(pathToGroup(groups, 'a2')).toEqual(['a', 'a1', 'a2']);
  });

  it('stops rather than looping if the rows somehow describe a cycle', () => {
    const groups = [group('x', 'y', 'x'), group('y', 'x', 'y')];
    expect(pathToGroup(groups, 'x')).toEqual(['y', 'x']);
  });

  it('is empty for an id that is not in the tree', () => {
    expect(pathToGroup([], 'nope')).toEqual([]);
  });
});

describe('descendantsOf', () => {
  // A folder's report and a folder's settings both ask the same question — "what is
  // actually in here" — and both mean the whole subtree, not the one level the rail is
  // showing.
  const groups = [
    group('a', null, 'fleet'),
    group('a1', 'a', 'marketing'),
    group('a2', 'a', 'zebra', 1),
    group('b', null, 'other'),
  ];
  const items = [
    repo('r1', 'a', 'acme/one'),
    repo('r2', 'a1', 'acme/two'),
    repo('r3', 'a2', 'acme/three'),
    repo('r4', 'b', 'acme/four'),
  ];

  it('reads in rail order: a folder’s own repositories, then its sub-folders’', () => {
    // The order the rail draws is the order the report stacks its sections, so a section
    // is found where the eye already learned to look for the row.
    expect(descendantsOf(items, groups, 'a').map((d) => d.repo.id)).toEqual([
      'r1',
      'r2',
      'r3',
    ]);
  });

  it('names each repository by the folders between it and the start', () => {
    // Two repositories called `web` in two sub-folders are one word apart, and the word
    // is the sub-folder — so the path is relative to what was CLICKED, not to the root.
    expect(descendantsOf(items, groups, 'a')).toMatchObject([
      { relativePath: '' },
      { relativePath: 'marketing' },
      { relativePath: 'zebra' },
    ]);
  });

  it('joins nested folder names with a slash', () => {
    const deep = [...groups, group('a1x', 'a1', 'europe')];
    const withDeep = [...items, repo('r5', 'a1x', 'acme/five')];
    const found = descendantsOf(withDeep, deep, 'a').find((d) => d.repo.id === 'r5');
    expect(found!.relativePath).toBe('marketing/europe');
  });

  it('walks the whole workspace from the root, orphans included', () => {
    // The root rail shows a repository whose groupId names a folder that is gone, so the
    // root walk has to find it too — otherwise it is unreachable from every folder at once.
    const orphaned = [...items, repo('r9', 'ghost', 'acme/orphan')];
    expect(descendantsOf(orphaned, groups, null).map((d) => d.repo.id)).toEqual([
      'r9',
      'r1',
      'r2',
      'r3',
      'r4',
    ]);
  });

  it('is empty for a folder id the tree has never heard of', () => {
    // Not "everything", which is what a root walk would return — an unknown folder holds
    // nothing, and answering with the whole workspace would deploy it.
    expect(descendantsOf(items, groups, 'nope')).toEqual([]);
  });

  it('is empty for a folder that is genuinely empty', () => {
    expect(descendantsOf([], groups, 'a')).toEqual([]);
  });
});
