import type { Group, RepoItem, TreeResponse } from '../types';

/**
 * The tree, as the HTDV wants it.
 *
 * The HTDV renders LEVELS, not nodes: a rail of roots, then a rail of the selected
 * folder's contents, then the detail pane. So the shape it needs is not the `parentId`
 * graph the backend sends but a LIST OF LEVELS derived from one path through it — and that
 * derivation is pure, which is why it lives here rather than inside the console component.
 * Every rule below (what sorts where, what an unreachable parent does, which rail is
 * selected) is then a case a test can state in three lines.
 */

/** What a rail row stands for. The two are addressed the same way — an id in a level — so
 *  the kind has to travel with it, or "delete the selection" cannot know what it deletes. */
export type NodeKind = 'group' | 'repo';

export interface NodeRef {
  kind: NodeKind;
  id: string;
}

/** One rail: the contents of one folder, plus which row in it is selected. */
export interface LevelPlan {
  /**
   * The rail's id. Stable and SEMANTIC — `shipr-root`, then `shipr-group-<id>` — because
   * the HTDV keys its per-rail state (scroll position, width) off it. An index-based id
   * would move every rail's state one place left when a folder is deleted.
   */
  id: string;
  /** The folder this rail lists, or null for the roots. */
  groupId: string | null;
  title: string;
  /** Sub-folders, then repositories: a rail reads top-down as containers first. */
  groups: Group[];
  repos: RepoItem[];
  /** The row selected in THIS rail — a sub-folder (the next rail exists) or a repository
   *  (the detail pane is showing it). Null when nothing here is selected. */
  selected: NodeRef | null;
}

/**
 * Position, then name.
 *
 * The SAME order the backend's `expandScope` walks a folder in, which is what makes "run
 * on this folder, one repository at a time in sorted order" mean the order on the screen.
 * A tie on position falls back to the name so the order is TOTAL — otherwise
 * `Array.prototype.sort`'s stability leaves it decided by whatever order Postgres returned,
 * and the log would walk an order the rail never showed.
 *
 * Two sorts rather than one generic one, because a repository's name is not a column: it is
 * `slug` and `shard` together, and two mirrors of one repository differ only in the second.
 * A single comparator over `name ?? slug` would have left every sharded pair tied.
 */
function sortGroups(rows: readonly Group[]): Group[] {
  return [...rows].sort(
    (a, b) => a.position - b.position || a.name.localeCompare(b.name),
  );
}

function sortRepos(rows: readonly RepoItem[]): RepoItem[] {
  return [...rows].sort(
    (a, b) =>
      a.position - b.position ||
      a.slug.localeCompare(b.slug) ||
      a.shard.localeCompare(b.shard),
  );
}

/** The folders directly inside `parentId` (null = the roots), in rail order. */
export function childGroups(
  groups: readonly Group[],
  parentId: string | null,
): Group[] {
  return sortGroups(groups.filter((g) => g.parentId === parentId));
}

/**
 * Every folder, depth-first, parents before their children — the rails read end to end.
 *
 * This is the order a FLAT list of folders wants: the move dialog's destinations, the
 * register dialog's picker. Both indent by `depth`, so a row that arrives before its parent
 * reads as belonging to whatever happened to precede it.
 *
 * NOT `path`. `path` is the backend's id ancestry (`/<id>/<child>/`), a key built so a
 * subtree is a prefix match on an index — sorting by it does keep children under their
 * parent, but it orders SIBLINGS by whatever uuid they drew, which is neither the rail's
 * order nor any order an operator arranged. Walking the parent graph with the rail's own
 * comparator is the only way the menu and the rail agree.
 *
 * A folder whose `parentId` names a row that is not here is unreachable from any root and
 * is DROPPED, the same way an orphaned rail would never draw it. (`reposIn` surfaces an
 * orphaned repository at the root instead — a repository is the thing a per-repository
 * grant exists to expose, and a folder is not.)
 */
export function flattenGroups(groups: readonly Group[]): Group[] {
  const out: Group[] = [];
  const walk = (parentId: string | null): void => {
    for (const g of childGroups(groups, parentId)) {
      out.push(g);
      walk(g.id);
    }
  };
  walk(null);
  return out;
}

/**
 * The repositories filed directly in `groupId` (null = the tree root), in rail order.
 *
 * A repository whose `groupId` names a folder that is NOT in `groups` is treated as
 * unfiled and surfaces at the ROOT. That case is reachable: the tree ships only the folders
 * a caller reaches, and a grant on one repository does not imply a grant on its folder's
 * ancestors. Dropping such a row instead would hide the one repository a per-repository
 * grant exists to expose — the failure mode the whole reach model is built to avoid.
 */
export function reposIn(
  items: readonly RepoItem[],
  groupId: string | null,
  groups: readonly Group[],
): RepoItem[] {
  const known = new Set(groups.map((g) => g.id));
  return sortRepos(
    items.filter((r) =>
      groupId === null
        ? r.groupId === null || !known.has(r.groupId)
        : r.groupId === groupId,
    ),
  );
}

/** One repository somewhere below a folder, and how far below. */
export interface Descendant {
  repo: RepoItem;
  /** The folders between the starting folder and this repository, joined with `/`. Empty
   *  for a repository filed directly in it. */
  relativePath: string;
}

/**
 * Every repository under `groupId`, however deep — the rails read end to end.
 *
 * Repositories filed HERE come before the sub-folders' contents, and the sub-folders come
 * in rail order, so this is exactly the sequence the rails show if you opened every one of
 * them in turn. That matters twice over: it is the order a folder's report reads in, and it
 * is the order the backend's `expandScope` walks a folder's run in, so "the fourth of
 * eleven" in the log is the fourth section on the screen.
 *
 * `null` starts at the tree root, which — via `reposIn` — sweeps up the unfiled and the
 * unreachably-filed too. A folder that is not in `groups` has NO descendants rather than
 * every repository: an unknown folder is not the root.
 */
export function descendantsOf(
  items: readonly RepoItem[],
  groups: readonly Group[],
  groupId: string | null,
): Descendant[] {
  if (groupId !== null && !groups.some((g) => g.id === groupId)) return [];
  const out: Descendant[] = [];
  const walk = (id: string | null, prefix: string): void => {
    for (const repo of reposIn(items, id, groups)) {
      out.push({ repo, relativePath: prefix });
    }
    for (const child of childGroups(groups, id)) {
      walk(child.id, prefix ? `${prefix}/${child.name}` : child.name);
    }
  };
  walk(groupId, '');
  return out;
}

/** The chain of folder ids from a root down to the open folder. `[]` is the root rail. */
export type TreePath = readonly string[];

export interface PlanOptions {
  tree: Pick<TreeResponse, 'groups' | 'items'>;
  /** The folders opened so far, outermost first. */
  path: TreePath;
  /** The repository the detail pane is showing, if any. */
  selectedRepoId?: string | null;
  /** The rail label for the outermost level. */
  rootTitle?: string;
}

/**
 * Turn one path through the tree into the rails that render it.
 *
 * ALWAYS returns at least one level (the roots), and always returns exactly
 * `path.length + 1` levels when every id in `path` resolves — the extra one is the open
 * folder's own contents, which is the rail the `+` button adds a sub-folder to.
 *
 * A path id that does NOT resolve (someone else deleted the folder while it was open)
 * TRUNCATES rather than throws: the rails before it are still correct, and the operator
 * ends up looking at the parent of what they lost instead of at an error.
 */
export function planLevels(opts: PlanOptions): LevelPlan[] {
  const { groups, items } = opts.tree;
  const byId = new Map(groups.map((g) => [g.id, g]));
  const levels: LevelPlan[] = [];

  let parentId: string | null = null;
  let title = opts.rootTitle ?? 'Repositories';
  let index = 0;

  for (;;) {
    const nextGroupId: string | undefined = opts.path[index];
    const next = nextGroupId === undefined ? undefined : byId.get(nextGroupId);
    // A folder in the path whose parent is not the rail we are on is a stale path too —
    // the folder was MOVED, not deleted. Same answer: stop here.
    const descends = next !== undefined && next.parentId === parentId;

    levels.push({
      id: parentId === null ? 'shipr-root' : `shipr-group-${parentId}`,
      groupId: parentId,
      title,
      groups: childGroups(groups, parentId),
      repos: reposIn(items, parentId, groups),
      selected: descends
        ? { kind: 'group', id: next.id }
        : opts.selectedRepoId
          ? repoSelection(items, groups, parentId, opts.selectedRepoId)
          : null,
    });

    if (!descends) break;
    parentId = next.id;
    title = next.name;
    index += 1;
  }

  return levels;
}

/** The repository selection for one rail: present only if that repository is filed HERE. */
function repoSelection(
  items: readonly RepoItem[],
  groups: readonly Group[],
  groupId: string | null,
  repoId: string,
): NodeRef | null {
  return reposIn(items, groupId, groups).some((r) => r.id === repoId)
    ? { kind: 'repo', id: repoId }
    : null;
}

/**
 * The path to a folder, outermost first — what a "reveal this folder" action needs.
 *
 * Walks `parentId` rather than parsing the materialised `path` column: the two agree (a
 * trigger maintains the column from the same edge), and the edge is the one the rest of
 * this module already reasons about. A cycle is impossible by CHECK and by trigger, but the
 * visited set is here anyway — a render loop is a worse failure than a truncated path.
 */
export function pathToGroup(
  groups: readonly Group[],
  groupId: string,
): string[] {
  const byId = new Map(groups.map((g) => [g.id, g]));
  const out: string[] = [];
  const seen = new Set<string>();
  let cursor: string | null = groupId;
  while (cursor && byId.has(cursor) && !seen.has(cursor)) {
    seen.add(cursor);
    out.unshift(cursor);
    cursor = byId.get(cursor)!.parentId;
  }
  return out;
}
