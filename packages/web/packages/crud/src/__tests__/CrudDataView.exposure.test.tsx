import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AuthUser } from '@agentic-toolkit/auth'
import type { CrudColumn, CrudExposure, CrudTableMeta } from '../types'

/** RowDetails' empty state — the signal that no row is open yet. */
const NO_ROW_OPEN = 'Select a row to see its details.'

/** The auth context as the view sees it. Only these two fields are read. */
let auth: { user: AuthUser | null; isLoading: boolean } = { user: null, isLoading: false }

/** A viewer of the given rank, in the REAL AuthUser shape — `isAdmin` reads `capabilities`,
 *  so a fake `{ admin: true }` here would pass while the production check returned false. */
const viewerUser = (admin: boolean): AuthUser =>
  ({ id: 'u1', email: 'u@example.com', capabilities: admin ? ['admin'] : [] }) as AuthUser

// The view reaches the network through these two only.
vi.mock('@agentic-toolkit/auth/client', () => ({
  authedJson: vi.fn(),
  authedRequest: vi.fn(),
}))
// Who the viewer is comes from the auth context; only THAT is faked. `isAdmin` and everything
// else stays real, so a call that passed the wrong thing (or no argument) fails here.
vi.mock('@agentic-toolkit/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@agentic-toolkit/auth')>()),
  useOptionalAuth: () => auth,
  useAuth: () => auth,
}))

const { authedJson } = vi.mocked(await import('@agentic-toolkit/auth/client'))
const { CrudDataView } = await import('../CrudDataView')

const col = (name: string, overrides: Partial<CrudColumn> = {}): CrudColumn => ({
  name,
  type: 'string',
  required: false,
  nullable: false,
  serverManaged: false,
  ...overrides,
})

const metaFor = (exposure: CrudExposure): CrudTableMeta => ({
  key: 'demo/widgets',
  schema: 'demo',
  table: 'widgets',
  basePath: '/demo/widgets',
  itemPath: '/demo/widgets/{id}',
  pkParams: ['id'],
  exposure,
  columns: [col('id', { serverManaged: true }), col('name')],
})

/** Render the view for one tier/viewer combination, with one row listed. */
async function renderView(exposure: CrudExposure, admin: boolean) {
  auth = { user: viewerUser(admin), isLoading: false }
  authedJson.mockResolvedValue([{ id: 'w1', name: 'Widget' }] as never)
  render(<CrudDataView meta={metaFor(exposure)} />)
  await waitFor(() => expect(screen.getByText('Widget')).toBeInTheDocument())
}

beforeEach(() => {
  authedJson.mockReset()
  auth = { user: null, isLoading: false }
})

describe('CrudDataView write gating by exposure tier', () => {
  // Auth resolves asynchronously, and "not an admin yet" is not "not an admin": rendering on
  // the guess would show an admin the read-only surface and then re-flow the whole table.
  it('waits for auth rather than rendering the pane as a non-admin', async () => {
    auth = { user: null, isLoading: true }
    authedJson.mockResolvedValue([{ id: 'w1', name: 'Widget' }] as never)
    const { rerender } = render(<CrudDataView meta={metaFor('catalog')} />)
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    expect(screen.queryByText('Read-only')).not.toBeInTheDocument()

    auth = { user: viewerUser(true), isLoading: false }
    rerender(<CrudDataView meta={metaFor('catalog')} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument())
    expect(screen.queryByText('Read-only')).not.toBeInTheDocument()
  })

  it('offers the full editing surface on an owner table to a non-admin', async () => {
    await renderView('owner', false)
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(screen.getByLabelText('Select all rows')).toBeInTheDocument()
    expect(screen.queryByText('Read-only')).not.toBeInTheDocument()
  })

  it('strips create/delete/selection on a catalog table for a non-admin', async () => {
    await renderView('catalog', false)
    expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Select all rows')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Select row w1')).not.toBeInTheDocument()
    // The bar says why it is empty rather than just losing its buttons.
    expect(screen.getByText('Read-only')).toBeInTheDocument()
  })

  it('restores the editing surface on a catalog table for an admin', async () => {
    await renderView('catalog', true)
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
    expect(screen.queryByText('Read-only')).not.toBeInTheDocument()
  })

  it('leaves Save and Cancel inert on a read-only table (nothing can go dirty)', async () => {
    await renderView('catalog', false)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('renders the row detail fields locked on a read-only table', async () => {
    await renderView('catalog', false)
    await userEvent.click(screen.getByText('Widget'))
    // Wait on the pane actually opening (its placeholder going away) before asserting a
    // NEGATIVE — otherwise the missing input could just be the pane not rendered yet.
    await waitFor(() => expect(screen.queryByText(NO_ROW_OPEN)).not.toBeInTheDocument())
    // Editable columns render a labelled <input>; locked ones render plain text.
    expect(screen.queryByLabelText('name')).not.toBeInTheDocument()
  })

  it('renders the same row detail field editable when the viewer may write', async () => {
    await renderView('owner', false)
    await userEvent.click(screen.getByText('Widget'))
    await waitFor(() => expect(screen.getByLabelText('name')).toBeInTheDocument())
  })
})
