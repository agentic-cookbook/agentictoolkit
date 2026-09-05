/**
 * What importing a document WOULD do, before anything does it.
 *
 * `shipr import` is dry by default and writes only under `--apply`, for a reason that is
 * stronger here than there: on a workstation the verb overwrites a JSON file, and here it
 * registers repositories on a forge. So the dialog shows this plan first, in the CLI's own
 * three marks — `+` new, `~` differs, `=` already as written — and a fourth the CLI has no
 * need for: `!`, a project this console cannot act on and why.
 *
 * PURE, AND THE ONLY PLACE THE COMPARISON LIVES. The dialog draws what this returns and the
 * apply walks the same rows, so what the operator read is what ran — the failure mode a dry
 * run has, and the only one worth having a dry run to avoid, is disagreeing with its own
 * apply.
 */

import { repoName, repoOwner, type ExportedProject, type ShiprDocument } from './document';
import { ENVIRONMENTS, type Environment, type Group, type RepoItem, type RepoPatch } from '../types';

/** `+` a registration, `~` a mirror that exists and does not match, `=` nothing to do, `!` a
 *  project this console has no way to act on. */
export type RowState = 'new' | 'differs' | 'same' | 'blocked';

export interface PlanRow {
  project: ExportedProject;
  state: RowState;
  /** Why it is blocked. Empty on every other state. */
  reason: string;
  /** What would change, one short phrase each — the words under a `~` row. */
  changes: string[];
  /** Things the import will NOT carry, said out loud rather than dropped: a branch that is
   *  fixed at registration, an environment this deployment does not have. */
  notes: string[];
  /** The mirror this project already is, when it is one. */
  repoId?: string;
  /** The folder it should end up in, and whether that folder has to be made first. */
  group: string | null;
  groupId?: string | null;
  groupIsNew?: boolean;
  /** Sent to `updateRepo` on a `differs` row. Absent on every other state. */
  patch?: RepoPatch;
}

export interface ImportPlan {
  rows: PlanRow[];
  /** Folder names in the document that this workspace has none of. Created first, because
   *  every row that names one needs its id. */
  newGroups: string[];
  counts: Record<RowState, number>;
}

/** The document's `group` is one directory name (the CLI's layout is one level deep), and a
 *  folder here is a node in a tree — so the match is BY NAME, at any depth, and only when the
 *  name is unambiguous. Two folders called `billing` in different parents is a question this
 *  file cannot answer, so it answers "make one at the top level" rather than guessing which
 *  existing one was meant. */
function findGroup(groups: readonly Group[], name: string): Group | null {
  const matches = groups.filter((g) => g.name === name);
  return matches.length === 1 ? matches[0]! : null;
}

const isEnvironment = (env: string): env is Environment =>
  (ENVIRONMENTS as readonly string[]).includes(env);

export interface ImportPlanOptions {
  document: ShiprDocument;
  groups: readonly Group[];
  items: readonly RepoItem[];
}

export function planImport({ document, groups, items }: ImportPlanOptions): ImportPlan {
  const byDeploymentSlug = new Map(items.map((item) => [item.slug, item]));
  const devSlugs = new Set(items.map((item) => item.devRepo?.slug).filter(Boolean));
  const newGroups: string[] = [];
  const rows = document.projects.map((project) => row(project, { groups, byDeploymentSlug, devSlugs, newGroups }));
  const counts: Record<RowState, number> = { new: 0, differs: 0, same: 0, blocked: 0 };
  for (const r of rows) counts[r.state] += 1;
  return { rows, newGroups, counts };
}

/** A folder only earns its place in the plan-level list once a row has actually said it
 *  needs it — see the two call sites below, both past every `blocked` return. A row this
 *  console refuses to import must not leave its folder behind for `apply` to build anyway. */
function addNewGroup(newGroups: string[], group: string | null, groupIsNew: boolean): void {
  if (groupIsNew && group && !newGroups.includes(group)) newGroups.push(group);
}

function row(
  project: ExportedProject,
  ctx: {
    groups: readonly Group[];
    byDeploymentSlug: Map<string, RepoItem>;
    devSlugs: Set<string | undefined>;
    newGroups: string[];
  },
): PlanRow {
  const notes: string[] = [];
  const group = project.group;
  let groupId: string | null = null;
  let groupIsNew = false;
  if (group) {
    const existing = findGroup(ctx.groups, group);
    if (existing) groupId = existing.id;
    else groupIsNew = true;
  }
  const base = { project, reason: '', changes: [], notes, group, groupId, groupIsNew };

  const devSlug = project.remotes.dev.slug;
  const deploymentSlug = project.remotes.deployment.slug;
  if (!devSlug) {
    return {
      ...base,
      state: 'blocked',
      reason: 'the file names no development repository, so there is nothing to register',
    };
  }
  if (!deploymentSlug) {
    return {
      ...base,
      state: 'blocked',
      reason: 'the file names no deployment repository, so this console cannot tell which row it is',
    };
  }

  const existing = ctx.byDeploymentSlug.get(deploymentSlug);
  if (!existing) {
    // A source that is already here, under a DIFFERENT deployment repository, is a shard —
    // and shards are declared in the repository's own `.shipr`, never in a form. Registering
    // the source again is what the backend refuses, so the refusal is said here instead,
    // where it can name the file that would have to change.
    if (ctx.devSlugs.has(devSlug)) {
      return {
        ...base,
        state: 'blocked',
        reason: `${devSlug} is registered here, but not with a deployment repository called ${repoName(
          deploymentSlug,
        )} — a second one is declared in that repository's \`.shipr\`, not added from here`,
      };
    }
    // Recorded the moment this row is ACCEPTED, not just at the top from the live tree — a
    // second row further down the same file claiming this source hits the check above
    // instead of both being waved through as registrations.
    ctx.devSlugs.add(devSlug);
    addNewGroup(ctx.newGroups, group, groupIsNew);
    return { ...base, state: 'new' };
  }

  const config = project.config;
  const changes: string[] = [];
  const patch: RepoPatch = {};

  if (existing.devRepo) {
    // FIXED AT REGISTRATION, both of them — there is no route on the wire that changes either,
    // because every branch downstream was cut from them. A file that disagrees is reported
    // rather than silently ignored: it is usually the first sign the two fleets are not the
    // same fleet.
    if (config.main_branch && config.main_branch !== existing.devRepo.mainBranch) {
      notes.push(
        `main branch is \`${existing.devRepo.mainBranch}\` here and \`${config.main_branch}\` in the file — fixed at registration, so it is left alone`,
      );
    }
    if (config.prepared_branch && config.prepared_branch !== existing.devRepo.preparedBranch) {
      notes.push(
        `prepared branch is \`${existing.devRepo.preparedBranch}\` here and \`${config.prepared_branch}\` in the file — fixed at registration, so it is left alone`,
      );
    }
  }

  if (config.ship_branch && config.ship_branch !== existing.shipBranch) {
    patch.shipBranch = config.ship_branch;
    changes.push(`ship branch → \`${config.ship_branch}\``);
  }
  const context = config.ci?.context;
  if (context && context !== existing.ciContext) {
    patch.ciContext = context;
    changes.push(`gate context → \`${context}\``);
  }

  const wanted: Partial<Record<Environment, string>> = {};
  if (config.environments) {
    for (const [env, branch] of Object.entries(config.environments)) {
      if (!isEnvironment(env)) {
        notes.push(`\`${env}\` is not an environment this console deploys to, so it is dropped`);
        continue;
      }
      if (typeof branch === 'string' && branch) wanted[env] = branch;
    }
  } else {
    // The KEY missing is silence, not an instruction — a file that never mentions
    // environments (or only touches other settings) must not clear every mapping this
    // console already holds. Only a `environments: {}` that is actually IN the file, checked
    // above, means "deploys to none of them now".
    Object.assign(wanted, existing.envBranches);
  }
  if (!sameEnvironments(wanted, existing.envBranches)) {
    patch.envBranches = wanted;
    changes.push(
      `environments → ${
        ENVIRONMENTS.filter((e) => wanted[e]).map((e) => `${e}:\`${wanted[e]}\``).join(', ') || 'none'
      }`,
    );
  }

  // The folder is part of the layout the file carries, so a repository filed somewhere else
  // here is a difference like any other. A folder that does not exist yet has no id at plan
  // time — `groupId` is `null` whether the file means "top level" or "a folder not made
  // yet" — so `groupIsNew` is checked FIRST, on its own: a repository moving into a
  // brand-new folder is a change no matter what its current folder's id happens to be. The
  // apply fills the id in from the folder it just made.
  if (
    (groupIsNew || (groupId ?? null) !== (existing.groupId ?? null)) &&
    (group !== null || existing.groupId !== null)
  ) {
    if (!groupIsNew) patch.groupId = groupId;
    changes.push(`folder → ${group ?? '(top level)'}`);
  }

  if (changes.length === 0) return { ...base, state: 'same', repoId: existing.id };
  addNewGroup(ctx.newGroups, group, groupIsNew);
  return { ...base, state: 'differs', repoId: existing.id, changes, patch };
}

function sameEnvironments(
  a: Partial<Record<Environment, string>>,
  b: Partial<Record<Environment, string>>,
): boolean {
  return ENVIRONMENTS.every((env) => (a[env] ?? null) === (b[env] ?? null));
}

/** What a `new` row will ask `register` for. Separated from the apply so the confirm step can
 *  say the deployment repository by name — the one field an operator checks twice, because it
 *  is the repository the pipeline will push branches on. */
export function registerBodyOf(row: PlanRow, groupId: string | null, connectionId?: string) {
  const project = row.project;
  const deployment = project.remotes.deployment.slug ?? '';
  const config = project.config;
  return {
    slug: project.remotes.dev.slug!,
    ...(connectionId ? { connectionId } : {}),
    ...(groupId ? { groupId } : {}),
    ...(config.main_branch ? { mainBranch: config.main_branch } : {}),
    ...(config.prepared_branch ? { preparedBranch: config.prepared_branch } : {}),
    // Sent whether or not they match what the server would derive. The file NAMES the
    // deployment repository, and a registration that quietly landed on a differently-named
    // one because the default happened to differ is the failure this whole document exists to
    // prevent. Where the repository's own `.shipr` declares its shards, the backend ignores
    // both fields — the file and the declaration must not be able to say two different things.
    ...(deployment ? { deploymentOwner: repoOwner(deployment), deploymentName: repoName(deployment) } : {}),
  };
}
