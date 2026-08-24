/**
 * `hideItemIcons` — a LEVEL-wide opt-out from the leading row icon.
 *
 * Research's document rows carry no identity icon: the only discrete state a row has
 * (published) is a trailing mark, and a leading icon there was a second copy of it.
 * Dropping `item.icon` cannot express that, because `itemButton` substitutes
 * `FALLBACK_ICON` for a missing one — deliberately, since the collapsed and covered
 * rails are ICON-ONLY strips where the icon is all that is left of the row. So the
 * opt-out is per level and applies to the expanded list ONLY; the icon-only modes keep
 * their icon whatever this says.
 */
/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { TopicDetail, type TopicDetailItem } from '../blocks/topic-detail'

const ITEMS: TopicDetailItem[] = [
  { id: 'a', label: 'Intelligence at the Edges', trailing: <span data-published /> },
  { id: 'b', label: 'Draft Notes' },
]

function renderRail(opts: { hideItemIcons?: boolean; collapsed?: boolean }) {
  return render(
    <TopicDetail
      items={ITEMS}
      selectedId={null}
      onSelect={() => {}}
      collapsed={opts.collapsed ?? false}
      hideItemIcons={opts.hideItemIcons}
    >
      <div>detail</div>
    </TopicDetail>,
  )
}

afterEach(cleanup)

describe('TopicDetail hideItemIcons', () => {
  it('renders the leading icon by default (the fallback stands in for a missing one)', () => {
    renderRail({})
    const row = screen.getByRole('button', { name: /^Draft Notes/ })
    expect(row.querySelector('[data-htd-icon]')).not.toBeNull()
  })

  it('drops the leading icon on every row of the level when set', () => {
    renderRail({ hideItemIcons: true })
    for (const name of [/^Intelligence at the Edges/, /^Draft Notes/]) {
      expect(screen.getByRole('button', { name }).querySelector('[data-htd-icon]')).toBeNull()
    }
  })

  it('keeps the trailing accessory — the row still shows its one state', () => {
    renderRail({ hideItemIcons: true })
    const published = screen.getByRole('button', { name: /^Intelligence at the Edges/ })
    expect(published.querySelector('[data-published]')).not.toBeNull()
    expect(
      screen.getByRole('button', { name: /^Draft Notes/ }).querySelector('[data-published]'),
    ).toBeNull()
  })

  it('is IGNORED in the collapsed icon strip, where the icon is the whole row', () => {
    renderRail({ hideItemIcons: true, collapsed: true })
    const row = screen.getByRole('button', { name: /^Draft Notes/ })
    expect(row.querySelector('[data-htd-icon]')).not.toBeNull()
  })
})

describe('TopicDetail hideItemIcons and blocked', () => {
  const BLOCKED: TopicDetailItem[] = [
    { id: 'a', label: 'Intelligence at the Edges', blocked: true },
    { id: 'b', label: 'Draft Notes' },
  ]

  function renderBlocked(hideItemIcons: boolean) {
    return render(
      <TopicDetail
        items={BLOCKED}
        selectedId={null}
        onSelect={() => {}}
        collapsed={false}
        hideItemIcons={hideItemIcons}
      >
        <div>detail</div>
      </TopicDetail>,
    )
  }

  it('still marks a blocked row when the level hides its icons', () => {
    // `hideItemIcons` is about IDENTITY; `blocked` is STATE. The dot used to be nested in
    // the icon span, so a level that dropped icons dropped the marker too — while the row
    // went on announcing ", needs attention" with nothing visible behind it.
    renderBlocked(true)
    const row = screen.getByRole('button', { name: /^Intelligence at the Edges/ })
    expect(row.querySelector('[data-htd-icon]')).toBeNull()
    expect(row.querySelector('[data-htd-blocked]')).not.toBeNull()
    expect(row).toHaveAccessibleName(/needs attention/)
  })

  it('leaves an unblocked row on the same level unmarked', () => {
    renderBlocked(true)
    const row = screen.getByRole('button', { name: /^Draft Notes/ })
    expect(row.querySelector('[data-htd-blocked]')).toBeNull()
  })

  it('keeps the marker on the icon when icons are shown, not beside it', () => {
    renderBlocked(false)
    const row = screen.getByRole('button', { name: /^Intelligence at the Edges/ })
    expect(row.querySelectorAll('[data-htd-blocked]')).toHaveLength(1)
    expect(row.querySelector('[data-htd-icon] [data-htd-blocked]')).not.toBeNull()
  })
})
