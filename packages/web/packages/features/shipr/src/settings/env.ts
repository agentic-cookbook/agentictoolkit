import { ENVIRONMENTS, type Environment, type Repo } from '../types';

/**
 * Which environments a repository is live in, as three checkboxes.
 *
 * There is no `enabled` column. An environment is live for a repository exactly when
 * `envBranches` names a branch for it — absent means the pipeline does not push there and
 * the ladder drops the column rather than drawing it empty. So a checkbox here is a key in
 * a map, and the whole job of this module is turning three booleans back into that map
 * without losing what the map already said.
 *
 * THE BRANCH NAME IS NOT THE CHECKBOX. `defaultEnvBranches()` on the backend seeds each
 * environment with a branch of its own name, but a repository is free to deploy `staging`
 * from `release/next`, and unticking then reticking the box must not quietly rename it.
 * Every function here therefore preserves an existing branch name and only invents one
 * (`env`) for an environment that had none.
 */
export type EnvFlags = Record<Environment, boolean>;

/** Ticked ⇔ this repository deploys there. */
export function flagsOf(repo: Pick<Repo, 'envBranches'>): EnvFlags {
  return Object.fromEntries(
    ENVIRONMENTS.map((env) => [env, repo.envBranches[env] !== undefined]),
  ) as EnvFlags;
}

/**
 * What a FOLDER's three boxes start out as.
 *
 * A folder has no environments of its own — it borrows the answer from what is inside it.
 * When every repository agrees, the box shows that; when they disagree it shows unticked,
 * which is why nothing is written unless a box is actually touched (see `changed`). An
 * EMPTY folder reads as all-off rather than all-on: nothing in it deploys anywhere, because
 * there is nothing in it.
 */
export function commonFlags(repos: readonly Pick<Repo, 'envBranches'>[]): EnvFlags {
  return Object.fromEntries(
    ENVIRONMENTS.map((env) => [
      env,
      repos.length > 0 && repos.every((r) => r.envBranches[env] !== undefined),
    ]),
  ) as EnvFlags;
}

/** True where the repositories do not agree — the dialog says so rather than implying a
 *  consensus that unticking one box would then impose on all of them. */
export function mixedFlags(repos: readonly Pick<Repo, 'envBranches'>[]): EnvFlags {
  return Object.fromEntries(
    ENVIRONMENTS.map((env) => {
      const on = repos.filter((r) => r.envBranches[env] !== undefined).length;
      return [env, on > 0 && on < repos.length];
    }),
  ) as EnvFlags;
}

/** The environments whose box the operator actually MOVED. Everything else is left alone —
 *  on a folder that is the difference between "turn testing off everywhere" and "also
 *  quietly turn staging on for the four repositories that never had it". */
export function changed(before: EnvFlags, after: EnvFlags): Environment[] {
  return ENVIRONMENTS.filter((env) => before[env] !== after[env]);
}

/**
 * One repository's new `envBranches`, given the boxes that moved.
 *
 * `PATCH /shipr/repos/:id` REPLACES the whole map, so this has to return the complete
 * desired state rather than a delta — starting from what the repository already has is what
 * keeps the environments nobody touched, with the branch names they already had.
 */
export function applyFlags(
  current: Partial<Record<Environment, string>>,
  after: EnvFlags,
  touched: readonly Environment[],
): Partial<Record<Environment, string>> {
  const next: Partial<Record<Environment, string>> = { ...current };
  for (const env of touched) {
    if (after[env]) next[env] = current[env] ?? env;
    else delete next[env];
  }
  return next;
}

/** True when applying `touched` to this repository would change nothing — a repository that
 *  is already how the folder's boxes say leaves no PATCH behind. */
export function isUnchanged(
  current: Partial<Record<Environment, string>>,
  next: Partial<Record<Environment, string>>,
): boolean {
  return ENVIRONMENTS.every((env) => current[env] === next[env]);
}
