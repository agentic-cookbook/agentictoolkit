import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RegisterWizard } from '../toolbar/RegisterWizard';
import type {
  DeclarationResponse,
  ForgeConnection,
  RegisterRequest,
} from '../types';

/**
 * The wizard, driven through its two reads.
 *
 * WHAT IS BEING PINNED HERE is the branch at step 2, because it is the one place the dialog
 * decides something rather than showing something: a repository that declares its mirrors in
 * `.shipr` has nothing left to ask, and one that does not needs two answers with defaults
 * that must match what the server would have computed anyway. Getting that backwards is
 * silent — the wrong screen still submits, and the run creates a repository nobody named.
 */

const CONNECTIONS: ForgeConnection[] = [
  { id: 'c1', label: 'acme app', accountLogin: 'acme' },
  { id: 'c2', label: 'sandbox app', accountLogin: 'sandbox' },
];

const REPOSITORIES = [
  { slug: 'acme/site', defaultBranch: 'trunk', private: true },
  { slug: 'acme/taken', defaultBranch: 'main', private: false },
];

/** The declaration the fallback path gets: a file that named no `[deployments]`. */
const FALLBACK: DeclarationResponse = {
  deployments: null,
  fallbackSlug: 'acme/site-deployment',
};

const DECLARED: DeclarationResponse = {
  deployments: [
    { shard: 'eu', slug: 'acme/site-eu-deployment' },
    { shard: 'us', slug: 'acme/site-us-deployment' },
  ],
  fallbackSlug: 'acme/site-deployment',
};

function draw(
  declaration: DeclarationResponse,
  over: { registeredSlugs?: string[]; onSubmit?: (b: RegisterRequest) => Promise<void> } = {},
) {
  const client = {
    connectionRepositories: vi.fn().mockResolvedValue({ repositories: REPOSITORIES }),
    connectionDeclaration: vi.fn().mockResolvedValue(declaration),
  };
  const onSubmit = over.onSubmit ?? vi.fn().mockResolvedValue(undefined);
  render(
    <RegisterWizard
      open
      onClose={vi.fn()}
      client={client}
      groups={[]}
      connections={CONNECTIONS}
      registeredSlugs={over.registeredSlugs}
      onSubmit={onSubmit}
    />,
  );
  return { client, onSubmit };
}

/** Step 1 → step 2: pick the repository the list offers and press Next. */
async function toStepTwo(): Promise<void> {
  await userEvent.click(await screen.findByRole('button', { name: /acme\/site\b/ }));
  await userEvent.click(screen.getByRole('button', { name: 'Next' }));
  await screen.findByText(/step 2 of 3/);
}

describe('RegisterWizard — step 1', () => {
  it('reads the installation’s repositories rather than asking for a slug', async () => {
    const { client } = draw(FALLBACK);
    expect(await screen.findByRole('button', { name: /acme\/site\b/ })).toBeTruthy();
    // The FIRST connection, chosen for them: one installation is the common case, and a
    // dialog that opens on "(choose one)" makes the operator answer a question with one
    // possible answer before it will show them anything.
    expect(client.connectionRepositories).toHaveBeenCalledWith('c1');
  });

  it('offers an already registered repository disabled rather than omitting it', async () => {
    // "Why isn't it in the list" has no answer on a screen that simply leaves it out, and the
    // answer — it is already here — is the one thing that stops the operator looking.
    draw(FALLBACK, { registeredSlugs: ['acme/taken'] });
    const taken = await screen.findByRole('button', { name: /acme\/taken/ });
    expect(taken).toBeDisabled();
    expect(taken.textContent).toContain('already registered');
    expect(await screen.findByRole('button', { name: /acme\/site\b/ })).not.toBeDisabled();
  });

  it('takes the main branch from the forge’s answer, not from the word "main"', async () => {
    // `acme/site` defaults to `trunk`. Assuming `main` registers the repository against a
    // branch that does not exist, and the first status run is where that turns up.
    const { client } = draw(FALLBACK);
    await toStepTwo();
    expect(client.connectionDeclaration).toHaveBeenCalledWith('c1', 'acme/site', 'trunk');
  });

  it('re-reads when a different installation is chosen', async () => {
    const { client } = draw(FALLBACK);
    await screen.findByRole('button', { name: /acme\/site\b/ });
    await userEvent.selectOptions(
      screen.getByLabelText('GitHub App installation'),
      'c2',
    );
    expect(client.connectionRepositories).toHaveBeenLastCalledWith('c2');
  });
});

describe('RegisterWizard — step 2 with shards declared', () => {
  it('shows the table and offers nothing to choose', async () => {
    // The file already names every mirror. A form that could override it would be two sources
    // of truth for one slug — exactly the drift the CLI refuses.
    draw(DECLARED);
    await toStepTwo();
    expect(screen.getByText('acme/site-eu-deployment')).toBeTruthy();
    expect(screen.getByText('acme/site-us-deployment')).toBeTruthy();
    expect(screen.queryByLabelText('Organization')).toBeNull();
    expect(screen.queryByLabelText('Name')).toBeNull();
  });

  it('carries both shards through to the confirmation, and sends no override', async () => {
    const { onSubmit } = draw(DECLARED);
    await toStepTwo();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText(/step 3 of 3/);
    expect(screen.getByText(/create its 2 deployment repositories/)).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Register' }));
    expect(onSubmit).toHaveBeenCalledWith({
      slug: 'acme/site',
      connectionId: 'c1',
      mainBranch: 'trunk',
      preparedBranch: 'prepared',
    });
  });
});

describe('RegisterWizard — step 2 on the fallback', () => {
  it('offers org and name, defaulted from the server’s own convention', async () => {
    // Split from `fallbackSlug` rather than re-derived here: a repository registered from this
    // console and one registered from a workstation have to land on the same deployment repo.
    draw(FALLBACK);
    await toStepTwo();
    expect((screen.getByLabelText('Organization') as HTMLSelectElement).value).toBe('acme');
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe(
      'site-deployment',
    );
  });

  it('offers every account an installation was granted, and no other', async () => {
    // An org we hold no connection for would be a menu entry the run refuses.
    draw(FALLBACK);
    await toStepTwo();
    const options = [...(screen.getByLabelText('Organization') as HTMLSelectElement).options];
    expect(options.map((o) => o.value)).toEqual(['acme', 'sandbox']);
  });

  it('sends nothing when the defaults are left alone', async () => {
    // An override equal to the default is a field the request does not need to carry, and one
    // the server would have to reconcile against its own answer.
    const { onSubmit } = draw(FALLBACK);
    await toStepTwo();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Register' }));
    expect(onSubmit).toHaveBeenCalledWith({
      slug: 'acme/site',
      connectionId: 'c1',
      mainBranch: 'trunk',
      preparedBranch: 'prepared',
    });
  });

  it('sends the override once the operator changes it', async () => {
    const { onSubmit } = draw(FALLBACK);
    await toStepTwo();
    await userEvent.selectOptions(screen.getByLabelText('Organization'), 'sandbox');
    await userEvent.clear(screen.getByLabelText('Name'));
    await userEvent.type(screen.getByLabelText('Name'), 'site-live');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    // The confirmation names what will be created, from the same derivation step 2 showed —
    // so it cannot name a repository the previous screen did not.
    expect(await screen.findByText('sandbox/site-live')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Register' }));
    expect(onSubmit).toHaveBeenCalledWith({
      slug: 'acme/site',
      connectionId: 'c1',
      mainBranch: 'trunk',
      preparedBranch: 'prepared',
      deploymentOwner: 'sandbox',
      deploymentName: 'site-live',
    });
  });

  it('says the declaration was unusable when the server sends a note', async () => {
    // Present and broken is a different fact from absent, and worth one sentence: the operator
    // can go and fix the file.
    draw({ ...FALLBACK, note: 'deployments.eu.repo is not owner/name' });
    await toStepTwo();
    expect(
      screen.getByText(/deployments\.eu\.repo is not owner\/name/),
    ).toBeTruthy();
  });
});

describe('RegisterWizard — the confirmation', () => {
  it('says out loud that it writes nothing to the source repository', async () => {
    // An earlier draft of this dialog was going to tell the operator it commits a `.shipr`.
    // It does not, and the step that asks for the irreversible click is where that is settled.
    draw(FALLBACK);
    await toStepTwo();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(
      await screen.findByText(/Nothing is written to/),
    ).toBeTruthy();
  });
});
