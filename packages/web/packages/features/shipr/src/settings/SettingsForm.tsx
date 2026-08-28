'use client';

import * as React from 'react';

import { Button } from '@agenticdevelopertoolkit/ui/components/button';
import { Checkbox } from '@agenticdevelopertoolkit/ui/components/checkbox';
import { ErrorText } from '@agenticdevelopertoolkit/ui/components/error-text';

import { useSubmit } from '../toolbar/dialogs';
import { repoLabel, shardLabel } from '../tree/toLevels';
import type { Descendant } from '../tree/levels';
import {
  ENVIRONMENTS,
  type DevRepo,
  type Environment,
  type Group,
  type RepoItem,
} from '../types';
import {
  applyFlags,
  changed,
  commonFlags,
  flagsOf,
  isUnchanged,
  mixedFlags,
  type EnvFlags,
} from './env';

/**
 * Settings, as a FORM rather than as a dialog — the reference block for whatever is
 * selected, and the environment boxes that write to it.
 *
 * IT IS A FORM AND NOT A DIALOG BECAUSE IT HAS TWO HOSTS. The rail's gear menu opens it in
 * a modal ({@link SettingsDialog}), and the Configure dialog puts the same thing in its
 * detail pane, where a second modal on top of the first would be a dialog inside a dialog.
 * Both hosts ask the identical question — which environments does this ship to — so it is
 * one implementation with a frame around it, not two that must be kept agreeing.
 *
 * ONE FORM, THREE SHAPES, one question. On a MIRROR it shows that mirror's names and its
 * environment boxes. On a FOLDER the names would be meaningless — a folder has no branches —
 * so it shows what is in the folder instead, and the boxes speak for everything inside it.
 * On a DEV REPO it shows the repository's own branches and the mirrors cut from them, and
 * the boxes speak for every mirror. Splitting these would make the environment boxes, which
 * are the point, into three implementations of one rule.
 *
 * A save writes only the boxes the operator MOVED (`changed`). A folder whose repositories
 * disagree about `staging` shows that as mixed and leaves it that way unless it is touched —
 * the alternative is that opening a folder's settings and pressing Save silently imposes one
 * repository's answer on ten others.
 */

/**
 * One repository's settings after the form.
 *
 * The key is optional and a patch carries only what actually moved: a Save that touched
 * nothing on THIS repository is not a write, and a folder of eleven where one already reads
 * the way the boxes do is ten writes, not eleven.
 */
export interface RepoSettingsPatch {
  repoId: string;
  envBranches?: Partial<Record<Environment, string>>;
}

export type SettingsTarget =
  | { kind: 'repo'; repo: RepoItem }
  | { kind: 'group'; group: Group; contents: readonly Descendant[] }
  /** A source repository and every mirror cut from it — the Configure dialog's rail. The
   *  mirrors ride along because they are what the boxes write to: a dev repo has no
   *  `envBranches` of its own, it has shards that do. */
  | { kind: 'devRepo'; devRepo: DevRepo; mirrors: readonly RepoItem[] };

/** The mirrors a target's boxes write to, in one place: the whole difference between the
 *  three shapes, once the reference block above them has been drawn. */
export function reposOf(target: SettingsTarget | null): RepoItem[] {
  if (!target) return [];
  if (target.kind === 'repo') return [target.repo];
  if (target.kind === 'group') return target.contents.map((d) => d.repo);
  return [...target.mirrors];
}

/** What to call the thing being configured, for a heading or a dialog title. */
export function settingsTitle(target: SettingsTarget | null): string {
  if (!target) return 'Settings';
  if (target.kind === 'repo') return repoLabel(target.repo);
  if (target.kind === 'group') return target.group.name;
  return target.devRepo.slug;
}

/** One name/value line. Monospace, because every value here is a branch or a slug and the
 *  question being asked of it is usually "is that the exact string". */
function Fact({
  name,
  value,
}: {
  name: string;
  value: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex gap-2 text-xs">
      <dt className="w-28 shrink-0 text-apt-text-muted">{name}</dt>
      <dd className="min-w-0 break-all font-mono text-apt-text">{value}</dd>
    </div>
  );
}

/** The frame every reference block shares, so three blocks are one box. */
function Facts({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <dl className="flex flex-col gap-1 rounded border border-apt-border bg-apt-surface-2 px-3 py-2">
      {children}
    </dl>
  );
}

/** The reference block: what this mirror's pipeline is actually made of. */
function RepoFacts({ repo }: { repo: RepoItem }): React.ReactElement {
  return (
    <Facts>
      <Fact name="mirror" value={repo.slug} />
      {repo.devRepo ? (
        <>
          <Fact name="main" value={repo.devRepo.mainBranch} />
          <Fact name="prepared" value={repo.devRepo.preparedBranch} />
        </>
      ) : null}
      <Fact name="ship" value={repo.shipBranch} />
      {ENVIRONMENTS.map((env) =>
        repo.envBranches[env] ? (
          <Fact key={env} name={`${env} branch`} value={repo.envBranches[env]} />
        ) : null,
      )}
      <Fact name="gate context" value={repo.ciContext} />
      <Fact name="registered" value={repo.registeredAt ?? 'not provisioned yet'} />
    </Facts>
  );
}

/** The SOURCE repository's own block. Not the mirror's: nothing here is cut, everything
 *  here is what the mirrors are cut FROM. */
function DevRepoFacts({
  devRepo,
  mirrors,
}: {
  devRepo: DevRepo;
  mirrors: readonly RepoItem[];
}): React.ReactElement {
  return (
    <Facts>
      <Fact name="repository" value={devRepo.slug} />
      <Fact name="main" value={devRepo.mainBranch} />
      <Fact name="prepared" value={devRepo.preparedBranch} />
      <Fact
        name="mirrors"
        value={mirrors.length === 1 ? '1' : String(mirrors.length)}
      />
      {/* The sha of the `.shipr` the last run read. It answers "is the console looking at
          the file I just committed", which is the one question a stale declaration makes
          people ask. */}
      <Fact name="declaration" value={devRepo.declarationSha ?? 'never read'} />
    </Facts>
  );
}

/** A list of repositories, by whatever distinguishes them. Two repositories called `web` in
 *  two sub-folders are one word apart, and the word is the sub-folder; two mirrors of one
 *  repository are one word apart, and the word is the shard. */
function ContentsList({
  contents,
  emptyLabel,
}: {
  contents: readonly Descendant[];
  emptyLabel: string;
}): React.ReactElement {
  if (contents.length === 0) {
    return (
      <p className="rounded border border-apt-border bg-apt-surface-2 px-3 py-2 text-xs text-apt-text-muted">
        {emptyLabel}
      </p>
    );
  }
  return (
    <ul className="flex max-h-56 flex-col gap-1 overflow-auto rounded border border-apt-border bg-apt-surface-2 px-3 py-2">
      {contents.map(({ repo, relativePath }) => (
        <li key={repo.id} className="flex gap-2 text-xs">
          <span className="min-w-0 break-all font-mono text-apt-text">
            {relativePath ? `${relativePath}/` : ''}
            {repoLabel(repo)}
          </span>
          {shardLabel(repo) ? (
            <span className="text-apt-text-muted">{shardLabel(repo)}</span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export interface SettingsFormProps {
  /** Null draws nothing but the frame — a pane with no row selected. */
  target: SettingsTarget | null;
  /**
   * Re-seed the boxes from `target`. A host that MOUNTS this fresh per selection can leave
   * it true; the modal passes its own `open`, because a dialog is mounted while closed and
   * a parent re-render must not untick a box someone has just ticked.
   */
  active?: boolean;
  /** The repositories to write. Empty when nothing moved, and this does not call it then: a
   *  Save that writes nothing should still not spend eleven round trips saying so. */
  onSave: (patches: RepoSettingsPatch[]) => Promise<void>;
  /** Runs after a save RESOLVES. The modal closes on it; a pane stays put. */
  onSaved: () => void;
  /** Drawn beside Save. The settings modal passes Cancel; a host that draws its own
   *  buttons — see {@link SettingsFormProps.formId} — passes nothing, and neither does a
   *  pane, because a pane has no state to abandon: the boxes are the state, and leaving
   *  them is the cancel. */
  cancel?: React.ReactNode;
  /**
   * The id to hang on the `<form>`, so a button OUTSIDE it can submit it with `form=`.
   *
   * Given, this draws NO buttons of its own: the host's button is the Save, and two Saves
   * for one patch is two things to keep in step and two answers to "did that write". It is
   * how the Configure dialog's OK commits the boxes — the form is a pane in the middle of
   * that dialog and the footer is at the bottom of it, which is exactly the shape `form=`
   * exists for; the alternative is lifting every checkbox into the dialog so it can build
   * the patch itself, and then the modal and the pane compute the same diff twice.
   *
   * Undefined keeps the inline Save, which is what a pane with no footer under it needs.
   */
  formId?: string;
}

export function SettingsForm({
  target,
  active = true,
  onSave,
  onSaved,
  cancel,
  formId,
}: SettingsFormProps): React.ReactElement {
  // What the boxes said when this opened. Kept beside the live flags because the diff
  // between them is the whole write — see `changed`.
  const repos = React.useMemo(() => reposOf(target), [target]);
  const seed = React.useMemo<EnvFlags>(() => {
    if (!target) return commonFlags([]);
    return target.kind === 'repo' ? flagsOf(target.repo) : commonFlags(repos);
  }, [target, repos]);
  // Mixed is a statement about a SET, so it is only ever asked of the two shapes that are
  // one: a single mirror agrees with itself.
  const many = target !== null && target.kind !== 'repo';
  const mixed = React.useMemo<EnvFlags>(
    () => (many ? mixedFlags(repos) : mixedFlags([])),
    [many, repos],
  );

  const [flags, setFlags] = React.useState<EnvFlags>(seed);
  // Re-seed on OPEN and on a change of target, never on every render: a parent that
  // re-renders while a box is ticked must not untick it.
  React.useEffect(() => {
    if (active) setFlags(seed);
  }, [active, seed]);

  const touched = changed(seed, flags);

  const patches = React.useMemo<RepoSettingsPatch[]>(() => {
    if (touched.length === 0) return [];
    return (
      repos
        // Dropped again if THIS repository was already the way the boxes say — a folder of
        // eleven where one already reads that way is ten writes, not eleven.
        .filter(
          (repo) => !isUnchanged(repo.envBranches, applyFlags(repo.envBranches, flags, touched)),
        )
        .map((repo) => ({
          repoId: repo.id,
          envBranches: applyFlags(repo.envBranches, flags, touched),
        }))
    );
  }, [repos, flags, touched]);

  const submit = React.useCallback(
    () => (patches.length === 0 ? Promise.resolve() : onSave(patches)),
    [onSave, patches],
  );
  const { busy, error, run } = useSubmit(submit, onSaved);

  return (
    <form
      id={formId}
      onSubmit={(e) => {
        e.preventDefault();
        if (!busy) run();
      }}
      className="flex min-w-0 flex-col gap-3"
    >
      {target?.kind === 'repo' ? (
        <RepoFacts repo={target.repo} />
      ) : target?.kind === 'group' ? (
        <ContentsList
          contents={target.contents}
          emptyLabel="Nothing is filed in this folder yet."
        />
      ) : target ? (
        <>
          <DevRepoFacts devRepo={target.devRepo} mirrors={target.mirrors} />
          <ContentsList
            contents={target.mirrors.map((repo) => ({ repo, relativePath: '' }))}
            emptyLabel="No deployment repositories yet — registering creates them."
          />
        </>
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="pb-1 text-xs font-semibold text-apt-text-muted">
          Environments
        </legend>
        {ENVIRONMENTS.map((env) => (
          <label key={env} className="flex items-center gap-2 text-sm text-apt-text">
            {/* `aria-label` because the wrapping <label> names only labelable elements,
                and Base UI's checkbox is a button, not an input. */}
            <Checkbox
              checked={flags[env]}
              aria-label={env}
              onCheckedChange={(checked: boolean) =>
                setFlags((prev) => ({ ...prev, [env]: checked }))
              }
            />
            <span>{env}</span>
            {/* Mixed is stated, not averaged. It disappears the moment the box is
                touched, because from then on the box IS the answer for all of them. */}
            {many && mixed[env] && !touched.includes(env) ? (
              <span className="text-xs text-apt-text-muted">
                some of these repositories
              </span>
            ) : null}
          </label>
        ))}
      </fieldset>

      <ErrorText error={error} />
      {/* The error stays, the buttons go: a host that submits this from outside still needs
          the failure rendered where the boxes are, and it has no way to draw it itself. */}
      {formId ? null : (
        <div className="flex items-center justify-end gap-3 pt-1">
          {cancel}
          <Button type="submit" disabled={busy || patches.length === 0}>
            {busy
              ? 'Saving…'
              : patches.length > 1
                ? `Save ${patches.length} repositories`
                : 'Save'}
          </Button>
        </div>
      )}
    </form>
  );
}
