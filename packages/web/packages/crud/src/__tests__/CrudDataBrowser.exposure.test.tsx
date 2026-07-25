import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import type { AuthUser } from '@agentic-toolkit/auth'
import type { CrudExposure, CrudTableMeta } from '../types'
import type { CrudShellProps } from '../CrudDataBrowser'

/** The auth context as the browser sees it. Only these two fields are read. */
let auth: { user: AuthUser | null; isLoading: boolean } = { user: null, isLoading: false }

/** A viewer of the given rank, in the REAL AuthUser shape — `isAdmin` reads `capabilities`. */
const viewerUser = (admin: boolean): AuthUser =>
  ({ id: 'u1', email: 'u@example.com', capabilities: admin ? ['admin'] : [] }) as AuthUser

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
// Only the auth context is faked; `isAdmin` and the rest stay real.
vi.mock('@agentic-toolkit/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@agentic-toolkit/auth')>()),
  useOptionalAuth: () => auth,
  useAuth: () => auth,
}))
// The editor is network-bearing and tested on its own; here it only has to say WHICH table opened.
vi.mock('../CrudDataView', () => ({
  CrudDataView: ({ meta }: { meta: CrudTableMeta }) => <div data-testid="open">{meta.key}</div>,
}))

const { CrudDataBrowser } = await import('../CrudDataBrowser')

const table = (schema: string, name: string, exposure: CrudExposure): CrudTableMeta => ({
  key: `${schema}/${name}`,
  schema,
  table: name,
  basePath: `/${schema}/${name}`,
  itemPath: `/${schema}/${name}/{id}`,
  pkParams: ['id'],
  exposure,
  columns: [],
})

// Mirrors the real catalog's three interesting shapes: an all-admin schema (`system` holds only
// audit-events), a mixed one (`usage`), and an ordinary owner one.
const TABLES = [
  table('persona', 'personas', 'owner'),
  table('system', 'audit-events', 'admin'),
  table('usage', 'rate-limit-tiers', 'catalog'),
  table('usage', 'usage-events', 'admin'),
]

/** Stands in for the host's rail: publishes the levels the browser computed so the test can
 *  read them directly, instead of asserting through HierarchicalDetailView's own rendering. */
function RailProbe({ levels, children }: CrudShellProps) {
  return (
    <div>
      {levels.map((level) => (
        <ul key={level.id} aria-label={`${level.id} rail`}>
          {level.items.map((item) => (
            <li key={item.id}>{item.label}</li>
          ))}
          {level.items.length === 0 && <li>{level.emptyLabel}</li>}
        </ul>
      ))}
      {children}
    </div>
  )
}

const railRows = (level: 'schema' | 'table') =>
  within(screen.getByLabelText(`${level} rail`))
    .getAllByRole('listitem')
    .map((li) => li.textContent)

function renderBrowser(props: { activeSchema?: string; activeTable?: string } = {}) {
  render(
    <CrudDataBrowser basePath="/all-data" tables={TABLES} shell={RailProbe} {...props} />,
  )
}

beforeEach(() => {
  auth = { user: null, isLoading: false }
})

describe('CrudDataBrowser listing by exposure tier', () => {
  it('hides a schema whose every table is admin-only from a non-admin', () => {
    auth = { user: viewerUser(false), isLoading: false }
    renderBrowser()
    expect(railRows('schema')).toEqual(['persona', 'usage'])
  })

  it('lists every schema for an admin', () => {
    auth = { user: viewerUser(true), isLoading: false }
    renderBrowser()
    expect(railRows('schema')).toEqual(['persona', 'system', 'usage'])
  })

  it('filters within a mixed schema, keeping the readable (catalog) table', () => {
    auth = { user: viewerUser(false), isLoading: false }
    renderBrowser({ activeSchema: 'usage' })
    expect(railRows('table')).toEqual(['rate-limit-tiers'])
  })

  it('opens nothing when a deep link names a table this viewer may not read', () => {
    auth = { user: viewerUser(false), isLoading: false }
    renderBrowser({ activeSchema: 'system', activeTable: 'audit-events' })
    expect(screen.queryByTestId('open')).not.toBeInTheDocument()
    // Falls back to "nothing open", not a phantom selection of a hidden table.
    expect(screen.getByText('Pick a schema, then a table.')).toBeInTheDocument()
  })

  it('opens the table when the viewer may read it', () => {
    auth = { user: viewerUser(true), isLoading: false }
    renderBrowser({ activeSchema: 'system', activeTable: 'audit-events' })
    expect(screen.getByTestId('open')).toHaveTextContent('system/audit-events')
  })

  // "Not known yet" must not be answered as "not an admin", or an admin's deep-linked schema
  // vanishes from the rail and pops back a paint later.
  it('shows nothing but a loading state until auth settles', () => {
    auth = { user: null, isLoading: true }
    renderBrowser({ activeSchema: 'system', activeTable: 'audit-events' })
    expect(railRows('schema')).toEqual(['Loading…'])
    expect(screen.queryByTestId('open')).not.toBeInTheDocument()
    expect(screen.queryByText('Pick a schema, then a table.')).not.toBeInTheDocument()
  })
})
