/** Unit tests for the dashboard-stat family extracted from the status board:
 *  Stat/StatRow (tone-tinted figure + micro label), StatusDot (glowing live
 *  light), ExternalLink (new-tab deep link), SectionLabel (display
 *  micro-heading), Pagination (Prev/Page X of Y/Next), CopyButton (clipboard +
 *  success flash), and the StatCard assembly (InfoPanel + rows + link +
 *  footnote). These pin the CONTRACT the status board and admin console
 *  conversions depend on. */
/// <reference types="@testing-library/jest-dom/vitest" />
import * as React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

import { Stat, StatRow } from '../components/stat'
import { StatusDot } from '../components/status-dot'
import { ExternalLink } from '../components/external-link'
import { SectionLabel, sectionLabelClass } from '../components/section-label'
import { Pagination } from '../components/pagination'
import { CopyButton } from '../components/copy-button'
import { StatCard } from '../blocks/stat-card'

describe('StatRow / Stat', () => {
  it('renders label and value, tinting the value by tone', () => {
    render(<StatRow label="uptime" value="99.9%" tone="success" />)
    expect(screen.getByText('uptime')).toBeInTheDocument()
    const value = screen.getByText('99.9%')
    expect(value.className).toContain('text-apt-green')
  })

  it('defaults the value to the neutral text tone', () => {
    render(<StatRow label="builds · 24h" value="12" />)
    expect(screen.getByText('12').className).toContain('text-apt-text')
  })

  it('lets valueClassName override the tone class (cn-merged)', () => {
    render(
      <StatRow label="env" value="PROD" tone="error" valueClassName="text-apt-blue" />,
    )
    const value = screen.getByText('PROD')
    expect(value.className).toContain('text-apt-blue')
    expect(value.className).not.toContain('text-apt-red')
  })

  it('Stat renders the vertical form with the same tone grammar', () => {
    render(<Stat label="failures · 24h" value="3" tone="error" />)
    expect(screen.getByText('3').className).toContain('text-apt-red')
    expect(screen.getByText('failures · 24h')).toBeInTheDocument()
  })
})

describe('StatusDot', () => {
  it('is decorative (aria-hidden) without a label', () => {
    const { container } = render(<StatusDot tone="success" />)
    const dot = container.querySelector('span')!
    expect(dot).toHaveAttribute('aria-hidden', 'true')
    expect(dot.style.background).toBe('currentcolor')
  })

  it('is an accessible image when labeled, and scales its glow with size', () => {
    const { container } = render(<StatusDot tone="error" size={20} label="down" />)
    const dot = screen.getByRole('img', { name: 'down' })
    expect(dot.className).toContain('text-apt-red')
    expect(dot.style.boxShadow).toContain('11px') // round(20 * 0.55)
    expect(container.querySelector('[aria-hidden="true"]')).toBeNull()
  })
})

describe('ExternalLink', () => {
  it('opens in a new tab with noopener and renders the ↗ glyph', () => {
    render(<ExternalLink href="https://example.com">PostHog</ExternalLink>)
    const a = screen.getByRole('link', { name: /PostHog/ })
    expect(a).toHaveAttribute('target', '_blank')
    expect(a).toHaveAttribute('rel', 'noopener noreferrer')
    expect(a).toHaveTextContent('↗')
  })

  it('drops the glyph when a leading icon carries the meaning', () => {
    render(
      <ExternalLink href="https://example.com" glyph={false}>
        GitHub
      </ExternalLink>,
    )
    expect(screen.getByRole('link', { name: 'GitHub' })).not.toHaveTextContent('↗')
  })
})

describe('SectionLabel', () => {
  it('renders the micro-heading treatment', () => {
    render(<SectionLabel>Recent activity</SectionLabel>)
    const label = screen.getByText('Recent activity')
    for (const cls of sectionLabelClass.split(' ')) {
      expect(label.className).toContain(cls)
    }
  })

  it('renders a trailing slot on the same row', () => {
    render(<SectionLabel trailing={<button>gear</button>}>Stats</SectionLabel>)
    expect(screen.getByText('Stats')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'gear' })).toBeInTheDocument()
  })
})

describe('Pagination', () => {
  it('renders nothing for a single page', () => {
    const { container } = render(
      <Pagination page={1} totalPages={1} onPageChange={() => {}} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('disables Prev on the first page and Next on the last, and pages both ways', () => {
    const onPageChange = vi.fn()
    const { rerender } = render(
      <Pagination page={1} totalPages={3} onPageChange={onPageChange} />,
    )
    expect(screen.getByRole('button', { name: 'Prev' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(onPageChange).toHaveBeenCalledWith(2)

    rerender(<Pagination page={3} totalPages={3} onPageChange={onPageChange} />)
    expect(screen.getByText('Page 3 of 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Prev' }))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })
})

describe('CopyButton', () => {
  it('copies getText() and flashes the success state', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(<CopyButton getText={() => 'rows'} label="Copy rows" />)
    const btn = screen.getByRole('button', { name: 'Copy rows' })
    fireEvent.click(btn)
    expect(writeText).toHaveBeenCalledWith('rows')
    await waitFor(() => expect(btn).toHaveAttribute('title', 'Copied!'))
  })

  it('copies nothing when getText() is empty', () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(<CopyButton getText={() => ''} label="Copy" />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    expect(writeText).not.toHaveBeenCalled()
  })
})

describe('StatCard', () => {
  it('assembles InfoPanel + stat rows + deep link + footnote', () => {
    render(
      <StatCard
        title="Traffic"
        link={{ href: 'https://us.posthog.com', label: 'PostHog' }}
        stats={[
          { label: 'pageviews · 7d', value: '637' },
          { label: 'visitors · 7d', value: '538' },
        ]}
        footnote="anonymous · cookieless · approximate"
      />,
    )
    expect(screen.getByRole('region', { name: 'Traffic' })).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /PostHog/ })
    expect(link).toHaveAttribute('href', 'https://us.posthog.com')
    expect(screen.getByText('pageviews · 7d')).toBeInTheDocument()
    expect(screen.getByText('637')).toBeInTheDocument()
    expect(
      screen.getByText('anonymous · cookieless · approximate'),
    ).toBeInTheDocument()
  })

  it('renders freeform children after the declarative rows', () => {
    render(
      <StatCard title="Errors" stats={[{ label: 'open issues', value: '0' }]}>
        <div>✓ No errors reported</div>
      </StatCard>,
    )
    expect(screen.getByText('✓ No errors reported')).toBeInTheDocument()
  })

  it('renders extra header actions after the deep link', () => {
    render(
      <StatCard
        title="lewis"
        link={{ href: 'https://example.com', label: 'Grafana' }}
        actions={<span data-testid="status-word">healthy</span>}
      />,
    )
    const region = screen.getByRole('region', { name: 'lewis' })
    const link = screen.getByRole('link', { name: /Grafana/ })
    const word = screen.getByTestId('status-word')
    expect(region).toContainElement(word)
    // Both live in the header's actions slot, link first.
    expect(link.compareDocumentPosition(word) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('passes host attributes (data-*) through to the panel root', () => {
    render(
      <StatCard
        title="lewis"
        data-testid="monitor-card"
        data-monitor="lewis.example.com"
        data-phase="ok"
      />,
    )
    const card = screen.getByTestId('monitor-card')
    expect(card.tagName).toBe('SECTION')
    expect(card).toHaveAttribute('data-monitor', 'lewis.example.com')
    expect(card).toHaveAttribute('data-phase', 'ok')
  })

  it('omits the header actions slot when neither link nor actions is given', () => {
    render(<StatCard title="Quiet" stats={[{ label: 'x', value: '1' }]} />)
    expect(screen.queryByRole('link')).toBeNull()
  })
})
