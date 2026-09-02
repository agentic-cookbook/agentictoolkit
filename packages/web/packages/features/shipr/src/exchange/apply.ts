/**
 * Running an import plan: the folders, the registrations, the settings — in that order,
 * because each step needs the one before it to have happened.
 *
 * IT REPLAYS THE CONSOLE'S OWN CALLS and invents no endpoint. A folder is `createGroup`, a new
 * project is `register`, a project that exists and differs is `updateRepo` — the same three
 * writes a person makes by hand, in the same order, with the same refusals coming back. There
 * is no bulk import route on the backend, and this is the argument for not adding one: a
 * replay cannot do anything an operator could not, so nothing here needs its own permission
 * check, its own audit line, or its own way to go wrong.
 *
 * SEQUENTIAL, AND THE FIRST FAILURE STOPS THE REST — `onMove`'s rule, for `onMove`'s reason: a
 * partial import the operator can see the extent of is recoverable; one that reports success
 * while three registrations silently failed is not. What HAD been done by then is in the
 * result, and the whole verb is idempotent, so the answer to a failure halfway is to fix what
 * it named and import the same file again.
 */

import { registerBodyOf, type ImportPlan, type PlanRow } from './plan';
import type { ShiprClient } from '../client';
import type { Group } from '../types';

/** The three writes an import makes, and nothing else. Narrower than the whole client so a
 *  test can drive it with three functions — and so this file cannot quietly grow a fourth. */
export type ImportClient = Pick<ShiprClient, 'createGroup' | 'register' | 'updateRepo'>;

export interface ApplyOptions {
  client: ImportClient;
  plan: ImportPlan;
  /** The folders that exist now — how a document's folder NAME becomes an id. */
  groups: readonly Group[];
  /** Which installation the registrations go out over. Required only when the plan has a
   *  `new` row; the backend takes the caller's own when it is absent, and refuses when there
   *  is nothing to take. */
  connectionId?: string;
}

export interface ApplyResult {
  /** Folder names created, in the order they were made. */
  groupsCreated: string[];
  /** One per registration queued — the run each one is, so the console can watch them the way
   *  it watches a registration made by hand. */
  registered: { slug: string; runId: string }[];
  /** Deployment repository slugs whose settings were written. */
  updated: string[];
  /** Rows that were already as the file describes. */
  unchanged: number;
  /** Rows this console could not act on, with the reason from the plan. Never a failure — a
   *  blocked row was never going to be attempted, and the plan said so before Apply was
   *  pressed. */
  skipped: { name: string; reason: string }[];
}

/**
 * A step of the import failed, carrying everything that had already happened.
 *
 * The partial result is not a nicety: the registrations that DID go out are runs walking
 * branches on a forge, and a caller that only received a message would drop them on the floor
 * — no queue, no rail, no Cancel. So the failure is thrown, and what survived it is attached.
 */
export class ImportError extends Error {
  constructor(
    message: string,
    readonly result: ApplyResult,
  ) {
    super(message);
    this.name = 'ImportError';
  }
}

export async function applyImport(options: ApplyOptions): Promise<ApplyResult> {
  const result: ApplyResult = {
    groupsCreated: [],
    registered: [],
    updated: [],
    unchanged: options.plan.counts.same,
    skipped: [],
  };
  try {
    await run(options, result);
  } catch (e) {
    throw new ImportError((e as Error).message, result);
  }
  return result;
}

async function run(
  { client, plan, groups, connectionId }: ApplyOptions,
  result: ApplyResult,
): Promise<void> {
  // FOLDERS FIRST, and at the top level: the document's layout is one directory deep, so a
  // group in it is a directory beside the projects rather than a node with a parent. A
  // console that nests deeper keeps its nesting — `planImport` matches an existing folder by
  // name at any depth, so only a genuinely new name reaches this loop.
  const idOfName = new Map<string, string>(
    groups.map((g) => [g.name, g.id] as const).filter(([name]) => groups.filter((g) => g.name === name).length === 1),
  );
  for (const name of plan.newGroups) {
    const group = await client.createGroup({ name });
    idOfName.set(name, group.id);
    result.groupsCreated.push(name);
  }

  const groupIdFor = (row: PlanRow): string | null =>
    row.group ? (idOfName.get(row.group) ?? null) : null;

  for (const row of plan.rows) {
    if (row.state === 'blocked') {
      result.skipped.push({ name: row.project.name, reason: row.reason });
      continue;
    }
    if (row.state === 'new') {
      const { runId } = await client.register(registerBodyOf(row, groupIdFor(row), connectionId));
      result.registered.push({ slug: row.project.remotes.dev.slug!, runId });
      continue;
    }
    if (row.state === 'differs' && row.repoId) {
      // The folder id the plan could not know, filled in from the folder just created. Every
      // other key of the patch was decided by the comparison and is passed through untouched.
      const patch = row.groupIsNew ? { ...row.patch, groupId: groupIdFor(row) } : row.patch!;
      await client.updateRepo(row.repoId, patch);
      result.updated.push(row.project.remotes.deployment.slug ?? row.project.name);
    }
  }
}
