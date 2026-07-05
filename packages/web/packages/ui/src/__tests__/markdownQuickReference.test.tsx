/**
 * Unit tests for MarkdownQuickReference — the toolbar control that opens a
 * dismissible popover of common markdown syntax. Uses the real Popover (base-ui);
 * the rect/getComputedStyle stubs in vitest.setup let the floating popup mount.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { MarkdownQuickReference } from '../components/markdown-quick-reference'

function trigger(): HTMLElement {
  return screen.getByRole('button', { name: 'Markdown quick reference' })
}

describe('MarkdownQuickReference', () => {
  it('renders a labelled trigger that starts collapsed', () => {
    render(<MarkdownQuickReference />)
    const btn = trigger()
    expect(btn).toBeInTheDocument()
    // No syntax content visible until opened.
    expect(screen.queryByText('Markdown quick reference')).toBeNull()
  })

  it('opens the popover with the common syntax on click', async () => {
    render(<MarkdownQuickReference />)
    fireEvent.click(trigger())
    expect(
      await screen.findByText('Markdown quick reference'),
    ).toBeInTheDocument()
    // A representative spread of the documented syntaxes.
    expect(screen.getByText('Headings')).toBeInTheDocument()
    expect(screen.getByText('Bold')).toBeInTheDocument()
    expect(screen.getByText('Inline code')).toBeInTheDocument()
    expect(screen.getByText('Code block')).toBeInTheDocument()
    expect(screen.getByText('Link')).toBeInTheDocument()
    expect(screen.getByText('Blockquote')).toBeInTheDocument()
  })

  it('dismisses on Escape', async () => {
    render(<MarkdownQuickReference />)
    fireEvent.click(trigger())
    await screen.findByText('Markdown quick reference')
    fireEvent.keyDown(document.body, { key: 'Escape' })
    await waitFor(() =>
      expect(screen.queryByText('Markdown quick reference')).toBeNull(),
    )
  })

  it('honors a custom trigger label', () => {
    render(<MarkdownQuickReference triggerLabel="Syntax" />)
    // Same aria-label, different visible text.
    expect(trigger()).toHaveTextContent('Syntax')
  })
})
