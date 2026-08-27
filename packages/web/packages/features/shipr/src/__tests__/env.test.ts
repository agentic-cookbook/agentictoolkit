import { describe, expect, it } from 'vitest';

import {
  applyFlags,
  changed,
  commonFlags,
  flagsOf,
  isUnchanged,
  mixedFlags,
} from '../settings/env';
import type { Environment } from '../types';

type Branches = Partial<Record<Environment, string>>;
const repo = (envBranches: Branches) => ({ envBranches });

describe('flagsOf', () => {
  it('reads a tick as "this environment has a branch"', () => {
    // There is no `enabled` column — an environment is live exactly when `envBranches`
    // names a branch for it.
    expect(flagsOf(repo({ testing: 'testing', production: 'main' }))).toEqual({
      testing: true,
      staging: false,
      production: true,
    });
  });
});

describe('commonFlags', () => {
  it('ticks only what every repository agrees on', () => {
    const flags = commonFlags([
      repo({ testing: 'testing', staging: 'staging' }),
      repo({ testing: 'testing' }),
    ]);
    expect(flags).toEqual({ testing: true, staging: false, production: false });
  });

  it('reads an EMPTY folder as all-off, not all-on', () => {
    // Nothing in it deploys anywhere, because there is nothing in it.
    expect(commonFlags([])).toEqual({
      testing: false,
      staging: false,
      production: false,
    });
  });
});

describe('mixedFlags', () => {
  it('names the environments the repositories disagree about', () => {
    const mixed = mixedFlags([
      repo({ testing: 'testing', staging: 'staging' }),
      repo({ testing: 'testing' }),
    ]);
    expect(mixed).toEqual({ testing: false, staging: true, production: false });
  });

  it('is never mixed when there is nothing to disagree', () => {
    expect(mixedFlags([])).toEqual({
      testing: false,
      staging: false,
      production: false,
    });
  });
});

describe('changed', () => {
  it('returns only the boxes that actually moved', () => {
    const before = { testing: true, staging: false, production: false };
    const after = { testing: false, staging: false, production: true };
    expect(changed(before, after)).toEqual(['testing', 'production']);
  });

  it('is empty when a dialog is opened and closed again', () => {
    const flags = { testing: true, staging: true, production: false };
    expect(changed(flags, flags)).toEqual([]);
  });
});

describe('applyFlags', () => {
  it('KEEPS a branch name a box was merely reticked over', () => {
    // A repository is free to deploy `staging` from `release/next`; unticking and reticking
    // the box must not quietly rename it.
    const current: Branches = { staging: 'release/next' };
    const off = applyFlags(current, { testing: false, staging: false, production: false }, [
      'staging',
    ]);
    expect(off).toEqual({});
    // …and the operator changes their mind, starting from what the repository still has.
    expect(
      applyFlags(current, { testing: false, staging: true, production: false }, [
        'staging',
      ]),
    ).toEqual({ staging: 'release/next' });
  });

  it('invents a branch only for an environment that had none', () => {
    expect(
      applyFlags({}, { testing: true, staging: false, production: false }, [
        'testing',
      ]),
    ).toEqual({ testing: 'testing' });
  });

  it('leaves every environment the operator did not touch exactly as it was', () => {
    // `PATCH /shipr/repos/:id` replaces the whole map, so an untouched environment survives
    // only because it is carried through here.
    const current: Branches = { testing: 'testing', production: 'main' };
    expect(
      applyFlags(current, { testing: false, staging: false, production: false }, [
        'staging',
      ]),
    ).toEqual(current);
  });
});

describe('isUnchanged', () => {
  it('spots the repository a folder-wide save has nothing to say to', () => {
    const current: Branches = { testing: 'testing' };
    expect(isUnchanged(current, { testing: 'testing' })).toBe(true);
    expect(isUnchanged(current, { testing: 'main' })).toBe(false);
    expect(isUnchanged(current, {})).toBe(false);
  });
});

describe('the folder save, end to end', () => {
  it('turns one box off across repositories that disagreed, and touches nobody else', () => {
    const repos = [
      repo({ testing: 'testing', staging: 'staging' }),
      repo({ testing: 'testing' }),
      repo({ staging: 'release/next' }),
    ];
    const seed = commonFlags(repos); // testing: false (one lacks it), staging: false
    const after = { ...seed, testing: true };
    const touched = changed(seed, after);
    expect(touched).toEqual(['testing']);

    const next = repos.map((r) => applyFlags(r.envBranches, after, touched));
    expect(next).toEqual([
      { testing: 'testing', staging: 'staging' },
      { testing: 'testing' },
      { testing: 'testing', staging: 'release/next' },
    ]);
    // Only the repository that lacked testing needs a write.
    expect(next.map((n, i) => isUnchanged(repos[i]!.envBranches, n))).toEqual([
      true,
      true,
      false,
    ]);
  });
});
