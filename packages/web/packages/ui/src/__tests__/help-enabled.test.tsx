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

  // The caller's class is LAYOUT, not decoration for the help affordance — adh's
  // header passes the class that centres the title, clips it and hides it on
  // mobile. Dropping it on the unknown-id path moved the site name off-centre on
  // every page, which is a worse failure than the missing help entry itself.
  it('keeps the caller className for an unknown id', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(
      <HelpContentProvider help={help}>
        <HelpEnabled id="missing-too" className="page-title">
          Cookbook
        </HelpEnabled>
      </HelpContentProvider>,
    )
    expect(screen.getByText('Cookbook')).toHaveClass('page-title')
  })

  it('uses the fallback copy when the site published no entry', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(
      <HelpContentProvider help={help}>
        <HelpEnabled id="unpublished" fallback="The registry blurb.">
          Admin
        </HelpEnabled>
      </HelpContentProvider>,
    )
    fireEvent.click(screen.getByText('Admin'))
    await waitFor(() =>
      expect(screen.getByText('The registry blurb.')).toBeInTheDocument(),
    )
    // A fallback is a deliberate choice by the caller, not a misconfiguration.
    expect(warn).not.toHaveBeenCalled()
  })

  it('prefers a real entry over the fallback', async () => {
    render(
      <HelpContentProvider help={help}>
        <HelpEnabled id="site-title" fallback="The registry blurb.">
          Cookbook
        </HelpEnabled>
      </HelpContentProvider>,
    )
    fireEvent.click(screen.getByText('Cookbook'))
    await waitFor(() =>
      expect(screen.getByText('What this site is for.')).toBeInTheDocument(),
    )
    expect(screen.queryByText('The registry blurb.')).toBeNull()
  })

  // NOTE: every unknown id in this file must be unique. The throttle is a
  // module-scope Set that no `afterEach` can reach — reusing an id across tests
  // would make this assertion depend on test order.
  it('warns once per unknown id, not once per render', () => {
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
