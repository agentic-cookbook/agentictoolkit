import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CrudColumn, CrudExposure, CrudTableMeta } from '../types'

/** RowDetails' empty state — the signal that no row is open yet. */
const NO_ROW_OPEN = 'Select a row to see its details.'

// The view reaches the network through these two only, and asks `useAuth` who the viewer is —
// the same seam useCrudResource's own test mocks.
vi.mock('@agentic-toolkit/auth/client', () => ({
  authedJson: vi.fn(),
  authedRequest: vi.fn(),
}))
vi.mock('@agentic-toolkit/auth', () => ({
  useAuth: () => ({ user: viewer }),
  isAdmin: () => viewer?.admin === true,
}))

let viewer: { admin: boolean } | null = null

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
  viewer = { admin }
  authedJson.mockResolvedValue([{ id: 'w1', name: 'Widget' }] as never)
  render(<CrudDataView meta={metaFor(exposure)} />)
  await waitFor(() => expect(screen.getByText('Widget')).toBeInTheDocument())
}

beforeEach(() => {
  authedJson.mockReset()
  viewer = null
})

describe('CrudDataView write gating by exposure tier', () => {
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
