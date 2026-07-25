import '@testing-library/jest-dom/vitest'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CrudTable, cellText, displayColumns } from '../CrudTable'
import type { CrudColumn, CrudTableMeta } from '../types'

const col = (name: string, overrides: Partial<CrudColumn> = {}): CrudColumn => ({
  name,
  type: 'string',
  required: false,
  nullable: false,
  serverManaged: false,
  ...overrides,
})

const meta: CrudTableMeta = {
  key: 'demo/widgets',
  schema: 'demo',
  table: 'widgets',
  basePath: '/demo/widgets',
  itemPath: '/demo/widgets/{id}',
  pkParams: ['id'],
  exposure: 'owner',
  columns: [
    col('id', { serverManaged: true }),
    col('name'),
    col('config', { type: 'object' }),
    col('a'),
    col('b'),
    col('c'),
    col('d'),
    col('e'),
  ],
}

const noHandlers = { onNew: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() }

describe('displayColumns', () => {
  it('puts the primary key first, skips object columns, caps the count', () => {
    const names = displayColumns(meta).map((c) => c.name)
    expect(names[0]).toBe('id')
    expect(names).not.toContain('config')
    expect(names.length).toBe(6)
  })
})

describe('cellText', () => {
  it('renders null as an em dash and truncates long values', () => {
    expect(cellText({ name: null }, col('name'))).toBe('—')
    expect(cellText({ name: 'x'.repeat(100) }, col('name'))).toBe(`${'x'.repeat(80)}…`)
    expect(cellText({ active: false }, col('active', { type: 'boolean' }))).toBe('false')
  })
})

describe('CrudTable', () => {
  it('shows the loading state', () => {
    render(<CrudTable meta={meta} rows={[]} loading error={null} {...noHandlers} />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows the empty state', () => {
    render(<CrudTable meta={meta} rows={[]} loading={false} error={null} {...noHandlers} />)
    expect(screen.getByText('No rows yet.')).toBeInTheDocument()
  })

  it('shows a load error', () => {
    render(
      <CrudTable meta={meta} rows={[]} loading={false} error="Service unavailable" {...noHandlers} />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Service unavailable')
  })

  it('renders rows and routes New/Edit/Delete to the callbacks', async () => {
    const user = userEvent.setup()
    const onNew = vi.fn()
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    const rows = [{ id: 'w1', name: 'Widget one' }]
    render(
      <CrudTable
        meta={meta}
        rows={rows}
        loading={false}
        error={null}
        onNew={onNew}
        onEdit={onEdit}
        onDelete={onDelete}
      />,
    )
    expect(screen.getByText('Widget one')).toBeInTheDocument()
    expect(screen.getByText('1 row')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'New' }))
    expect(onNew).toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Edit' }))
    expect(onEdit).toHaveBeenCalledWith(rows[0])
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledWith(rows[0])
  })
})
