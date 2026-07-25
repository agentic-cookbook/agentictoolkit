import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { AuthUser } from '@agentic-toolkit/auth'
import type { CrudColumn, CrudExposure, CrudTableMeta } from '../types'

/** The auth context as the page sees it. Only these two fields are read. */
let auth: { user: AuthUser | null; isLoading: boolean } = { user: null, isLoading: false }

const viewerUser = (admin: boolean): AuthUser =>
  ({ id: 'u1', email: 'u@example.com', capabilities: admin ? ['admin'] : [] }) as AuthUser

vi.mock('@agentic-toolkit/auth/client', () => ({
  authedJson: vi.fn(),
  authedRequest: vi.fn(),
}))
vi.mock('@agentic-toolkit/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@agentic-toolkit/auth')>()),
  useOptionalAuth: () => auth,
  useAuth: () => auth,
}))

const { authedJson } = vi.mocked(await import('@agentic-toolkit/auth/client'))
const { CrudTablePage } = await import('../CrudTablePage')

const col = (name: string, overrides: Partial<CrudColumn> = {}): CrudColumn => ({
  name,
  type: 'string',
  required: false,
  nullable: false,
  serverManaged: false,
  ...overrides,
})

const table = (name: string, exposure: CrudExposure): CrudTableMeta => ({
  key: `billing/${name}`,
  schema: 'billing',
  table: name,
  basePath: `/billing/${name}`,
  itemPath: `/billing/${name}/{id}`,
  pkParams: ['id'],
  exposure,
  columns: [col('id', { serverManaged: true }), col('name')],
})

// The hub's `billing` feature is catalog end to end; `usage` mixes catalog with admin.
const TIERS = table('subscription-tiers', 'catalog')
const LEDGER = table('usage-events', 'admin')

function renderPage(tables: CrudTableMeta[], activeTable?: string) {
  render(
    <CrudTablePage title="Billing" tables={tables} baseHref="/billing" activeTable={activeTable} />,
  )
}

beforeEach(() => {
  authedJson.mockReset()
  authedJson.mockResolvedValue([{ id: 'p1', name: 'Pro' }] as never)
  auth = { user: null, isLoading: false }
})

describe('CrudTablePage exposure gating', () => {
  it('renders a catalog table read-only for a non-admin', async () => {
    auth = { user: viewerUser(false), isLoading: false }
    renderPage([TIERS])
    await waitFor(() => expect(screen.getByText('Pro')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'New' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View' })).toBeInTheDocument()
    expect(screen.getByText('Read-only')).toBeInTheDocument()
  })

  it('restores the write surface for an admin', async () => {
    auth = { user: viewerUser(true), isLoading: false }
    renderPage([TIERS])
    await waitFor(() => expect(screen.getByText('Pro')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('drops an admin-tier table from the rail and never lists it', async () => {
    auth = { user: viewerUser(false), isLoading: false }
    renderPage([TIERS, LEDGER])
    await waitFor(() => expect(screen.getByText('Pro')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'subscription-tiers' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'usage-events' })).not.toBeInTheDocument()
    // One LIST, for the one readable table — the hidden one is never fetched.
    expect(authedJson).toHaveBeenCalledTimes(1)
    expect(authedJson.mock.calls[0]?.[0]).toContain('/billing/subscription-tiers')
  })

  it('refuses to open a table the URL names but the viewer may not read', () => {
    auth = { user: viewerUser(false), isLoading: false }
    renderPage([TIERS, LEDGER], 'usage-events')
    expect(screen.getByRole('status')).toHaveTextContent('No table “usage-events” here')
    expect(authedJson).not.toHaveBeenCalled()
  })

  it('says so plainly when nothing in the feature is readable', () => {
    auth = { user: viewerUser(false), isLoading: false }
    renderPage([LEDGER])
    expect(screen.getByRole('status')).toHaveTextContent('No tables here are available to you.')
    expect(authedJson).not.toHaveBeenCalled()
  })

  it('waits for auth rather than rendering the rail as a non-admin', () => {
    auth = { user: null, isLoading: true }
    renderPage([TIERS, LEDGER])
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(authedJson).not.toHaveBeenCalled()
  })
})
