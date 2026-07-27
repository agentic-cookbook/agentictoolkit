/**
 * `TopicDetailItem.blocked` used to render ONLY `data-blocked="true"` — a DOM marker with no CSS
 * rule anywhere in the repo, so the feature read as shipped while being completely invisible in
 * the product. It now renders an amber dot on the row's icon in BOTH the expanded list and the
 * collapsed icon strip (the mode where the label is gone and the user most needs to know which
 * topic is holding Save down), plus a non-colour-only accessible name.
 */
/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { TopicDetail, type TopicDetailItem } from '../blocks/topic-detail'

const ITEMS: TopicDetailItem[] = [
  { id: 'identity', label: 'Identity', blocked: true },
  { id: 'notes', label: 'Notes' },
]

function renderRail(collapsed: boolean) {
  return render(
    <TopicDetail items={ITEMS} selectedId={null} onSelect={() => {}} collapsed={collapsed}>
      <div>detail</div>
    </TopicDetail>,
  )
}

/** The row button for a topic, found by its `data-htd-row` marker + text/aria name. */
function row(name: RegExp): HTMLElement {
  return screen.getByRole('button', { name })
}

afterEach(cleanup)

describe('TopicDetailItem.blocked — visible marker', () => {
  it('draws the dot on the blocked row only, in the expanded list', () => {
    renderRail(false)
    const blocked = row(/^Identity/)
    const plain = row(/^Notes/)
    expect(blocked).toHaveAttribute('data-blocked', 'true')
    expect(blocked.querySelector('[data-htd-blocked]')).not.toBeNull()
    expect(plain.querySelector('[data-htd-blocked]')).toBeNull()
  })

  it('keeps the dot in the COLLAPSED icon strip, where the label is gone', () => {
    renderRail(true)
    const blocked = row(/^Identity/)
    // Collapsed rows carry no visible text at all — the dot is the only signal left.
    expect(blocked.textContent).toBe('')
    expect(blocked.querySelector('[data-htd-blocked]')).not.toBeNull()
  })

  it('says so in the accessible name in both modes — the dot is not colour-only', () => {
    renderRail(false)
    expect(row(/^Identity, needs attention$/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Notes, needs attention/ })).toBeNull()
    cleanup()

    // Icon-only rows carry an aria-label, which REPLACES the element's content for AT — so the
    // sr-only span can't be what speaks here; the label itself has to.
    renderRail(true)
    expect(row(/^Identity, needs attention$/)).toBeInTheDocument()
  })
})
