import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SettingsDialog, type SettingsTarget } from '../settings/SettingsDialog';
import type { Environment, RepoItem } from '../types';

/**
 * The environment fieldset — the settings dialog's one question.
 *
 * `env.test.ts` pins the three-state RULE (common, mixed, touched); this pins the WIRING of
 * it: that Save is dead until a box actually moves, that a folder's write reaches only the
 * repositories that are not already that way, and that an untouched environment keeps the
 * branch name it already had rather than being re-seeded with its own.
 */

function repo(id: string, envBranches: Partial<Record<Environment, string>>): RepoItem {
  return {
    id,
    devRepoId: `dev-${id}`,
    groupId: null,
    slug: `acme/${id}-deployment`,
    shard: 'all',
    shipBranch: 'ship',
    ciContext: 'gate',
    envBranches,
    registeredAt: null,
    position: 0,
    devRepo: null,
    state: null,
  };
}

function draw(target: SettingsTarget) {
  const onSave = vi.fn(() => Promise.resolve());
  const view = render(
    <SettingsDialog open target={target} onClose={() => {}} onSave={onSave} />,
  );
  return { onSave, ...view };
}

const box = (name: RegExp) => screen.findByRole('checkbox', { name });
const save = () => screen.getByRole('button', { name: /^Save/ });

const folder = (...contents: RepoItem[]): SettingsTarget => ({
  kind: 'group',
  group: { id: 'g1', parentId: null, name: 'Fleet', path: 'g1', depth: 0, position: 0 },
  contents: contents.map((r) => ({ repo: r, relativePath: '' })),
});

describe('the environment fieldset', () => {
  it('ticks the environments this repository already names a branch for', async () => {
    draw({ kind: 'repo', repo: repo('m1', { testing: 'testing' }) });
    expect(await box(/testing/i)).toHaveAttribute('aria-checked', 'true');
    expect(await box(/staging/i)).toHaveAttribute('aria-checked', 'false');
  });

  it('is dead until a box moves, and dead again when the box moves back', async () => {
    const { onSave } = draw({ kind: 'repo', repo: repo('m1', { testing: 'testing' }) });
    expect(save()).toBeDisabled();
    await userEvent.click(await box(/testing/i));
    expect(save()).not.toBeDisabled();
    await userEvent.click(await box(/testing/i));
    // Back where it started is not a write, even though two clicks happened.
    expect(save()).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('sends the whole desired map, keeping the branch names nobody touched', async () => {
    // PATCH replaces `envBranches`, so a save that turned `staging` on must still carry the
    // `release/next` the operator never edited.
    const { onSave } = draw({
      kind: 'repo',
      repo: repo('m1', { testing: 'release/next' }),
    });
    await userEvent.click(await box(/staging/i));
    await userEvent.click(save());
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0]![0]).toEqual([
      { repoId: 'm1', envBranches: { testing: 'release/next', staging: 'staging' } },
    ]);
  });

  it('says a folder disagrees rather than picking one repository’s answer', async () => {
    draw(folder(repo('m1', { testing: 'testing' }), repo('m2', {})));
    expect(await box(/testing/i)).toHaveAttribute('aria-checked', 'false');
    expect(screen.getAllByText('some of these repositories').length).toBeGreaterThan(0);
  });

  it("writes a folder's touched box to every repository that is not already that way", async () => {
    // One write, not two: the one already deploying to testing has nothing to say.
    const { onSave } = draw(folder(repo('m1', { testing: 'testing' }), repo('m2', {})));
    await userEvent.click(await box(/testing/i));
    await userEvent.click(save());
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0]![0]).toEqual([
      { repoId: 'm2', envBranches: { testing: 'testing' } },
    ]);
  });
});
