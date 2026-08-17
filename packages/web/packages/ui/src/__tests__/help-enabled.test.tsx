import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { HelpEnabled } from '../components/help-enabled'
import { HelpContentProvider, type SiteHelp } from '../components/help-content'

const help: SiteHelp = { 'site-title': { body: 'What this site is for.' } }

function mount(id: string) {
  return render(
    <HelpContentProvider help={help}>
      <HelpEnabled id={id}>Cookbook</HelpEnabled>
    </HelpContentProvider>,
  )
}

afterEach(() => vi.restoreAllMocks())

describe('HelpEnabled', () => {
  it('renders a badge beside the text, transparent until hover or focus', () => {
    mount('site-title')
    const badge = document.querySelector('[data-slot="help-enabled-badge"]')
    expect(badge).not.toBeNull()
    // jsdom resolves no :hover and no cascade, so the reveal itself is untestable
    // here. Pin the mechanism instead: the badge is always in the tree and starts
    // transparent, which is what keeps revealing it from reflowing the title.
    expect(badge).toHaveClass('opacity-0')
  })

  it('opens the popover when activated', async () => {
    mount('site-title')
    fireEvent.click(screen.getByText('Cookbook'))
    await waitFor(() =>
      expect(screen.getByText('What this site is for.')).toBeInTheDocument(),
    )
  })

  it('renders the children plain for an unknown id, with no badge', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(
      <HelpContentProvider help={help}>
        <HelpEnabled id="missing">Cookbook</HelpEnabled>
      </HelpContentProvider>,
    )
    expect(screen.getByText('Cookbook')).toBeInTheDocument()
    expect(document.querySelector('[data-slot="help-enabled-badge"]')).toBeNull()
  })

  it('warns once in development for an unknown id', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(
      <HelpContentProvider help={help}>
        <HelpEnabled id="also-missing">A</HelpEnabled>
        <HelpEnabled id="also-missing">B</HelpEnabled>
      </HelpContentProvider>,
    )
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0]?.[0]).toContain('also-missing')
  })
})
