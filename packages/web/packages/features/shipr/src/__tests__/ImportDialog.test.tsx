import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';

import { ImportDialog } from '../exchange/ImportDialog';
import type { ImportPlan } from '../exchange/plan';
import type { Group, RepoItem } from '../types';

/**
 * The dialog's ONE PROMISE: nothing in the file happens until it has been shown as a plan
 * and the plan has been applied. Everything below is a way of asking whether that promise
 * holds — a file that is refused, a file whose every row is already as written, and a file
 * that would register.
 */

const DOCUMENT = {
  schema: 'shipr-config-export',
  schema_version: 1,
  shipr_version: '25.2.0',
  exported_at: '2026-09-02T18:08:34Z',
  groups: ['billing'],
  projects: [
    {
      name: 'olylo',
      directory: 'olylo-deployment',
      group: null,
      remotes: {
        dev: { slug: 'acme/olylo' },
        deployment: { slug: 'acme/olylo-deployment' },
      },
      config: {
        version: 4,
        main_branch: 'main',
        prepared_branch: 'prepared',
        ship_branch: 'ship',
        environments: { testing: 'testing' },
        ci: { context: 'gate' },
      },
    },
  ],
};

const file = (body: unknown, name = 'shipr-config-export.json') =>
  new File([JSON.stringify(body, null, 2)], name, { type: 'application/json' });

const ITEM: RepoItem = {
  id: 'm1',
  devRepoId: 'd1',
  groupId: null,
  slug: 'acme/olylo-deployment',
  shard: 'all',
  shipBranch: 'ship',
  ciContext: 'gate',
  envBranches: { testing: 'testing' },
  registeredAt: null,
  position: 0,
  devRepo: {
    id: 'd1',
    slug: 'acme/olylo',
    mainBranch: 'main',
    preparedBranch: 'prepared',
    declarationSha: null,
    connectionId: 'c1',
  },
  state: null,
};

function draw(items: RepoItem[] = [], groups: Group[] = []) {
  const onImport = vi.fn<(plan: ImportPlan, connectionId?: string) => Promise<void>>(() =>
    Promise.resolve(),
  );
  const onClose = vi.fn();
  render(
    <ImportDialog
      open
      onClose={onClose}
      groups={groups}
      items={items}
      connections={[{ id: 'c9', label: 'acme', accountLogin: 'acme' }]}
      onImport={onImport}
    />,
  );
  return { onImport, onClose };
}

const pick = async (body: unknown) =>
  userEvent.upload(screen.getByLabelText('Configuration file'), file(body));

describe('the Import dialog', () => {
  it('will not import until a file has been read', async () => {
    draw();
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('says what is wrong with a file it will not read, and offers nothing to press', async () => {
    const { onImport } = draw();
    await pick({ projects: [] });
    expect(await screen.findByText(/not a shipr-config-export file/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
    expect(onImport).not.toHaveBeenCalled();
  });

  it('shows the plan before anything happens, and only then imports it', async () => {
    const { onImport } = draw();
    await pick(DOCUMENT);

    // The registration is described — both repositories by name — while nothing has been
    // called. This is the whole reason the dry run exists on this side of the wire.
    expect(await screen.findByText('olylo-deployment')).toBeInTheDocument();
    expect(screen.getByText(/1 to register/)).toBeInTheDocument();
    expect(onImport).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Import' }));
    await waitFor(() => expect(onImport).toHaveBeenCalled());
    const [plan, connectionId] = onImport.mock.calls[0]!;
    expect(plan.rows.map((r) => r.state)).toEqual(['new']);
    expect(connectionId).toBe('c9');
  });

  it('says who wrote the file', async () => {
    draw();
    await pick(DOCUMENT);
    expect(await screen.findByText(/written by shipr 25\.2\.0/)).toBeInTheDocument();
  });

  it('says a console-written file was written by the console', async () => {
    draw();
    await pick({ ...DOCUMENT, shipr_version: undefined, exported_by: 'shipr console' });
    expect(await screen.findByText(/written by shipr console/)).toBeInTheDocument();
  });

  it('has nothing to do when the fleet is already as the file describes', async () => {
    draw([ITEM]);
    await pick(DOCUMENT);
    expect(await screen.findByText('1 already as written')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  it('asks which installation only when something will be registered', async () => {
    draw([ITEM]);
    await pick(DOCUMENT);
    await screen.findByText('1 already as written');
    expect(screen.queryByLabelText('GitHub App installation')).toBeNull();
  });

  it('stays open on a failure, saying which one', async () => {
    const onImport = vi.fn(() => Promise.reject(new Error('that installation was revoked')));
    const onClose = vi.fn();
    render(
      <ImportDialog open onClose={onClose} groups={[]} items={[]} onImport={onImport} />,
    );
    await pick(DOCUMENT);
    await screen.findByText(/1 to register/);
    await userEvent.click(screen.getByRole('button', { name: 'Import' }));

    expect(await screen.findByText('that installation was revoked')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
