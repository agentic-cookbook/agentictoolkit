/** Unit tests for EmptyState — the shared "nothing here yet" placeholder. */
/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { EmptyState } from '../components/empty-state'

describe('EmptyState', () => {
  it('renders the title and omits optional slots by default', () => {
    render(<EmptyState title="No buckets yet." />)
    expect(screen.getByText('No buckets yet.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders description, icon, and action when provided', () => {
    render(
      <EmptyState
        title="No access lists"
        description="Create one to grant access."
        icon={<svg data-testid="glyph" />}
        action={<button type="button">New list</button>}
      />,
    )
    expect(screen.getByText('No access lists')).toBeInTheDocument()
    expect(screen.getByText('Create one to grant access.')).toBeInTheDocument()
    expect(screen.getByTestId('glyph')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'New list' })).toBeInTheDocument()
  })
})
