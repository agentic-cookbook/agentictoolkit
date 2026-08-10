/**
 * `TopicDetailItem.preview` — a few lines of the row's own CONTENT under its label, for lists
 * whose items ARE text (a note, a message). The rules worth pinning are the ones that fail
 * silently: `previewLines` comes from a user setting, so a value outside 0-4 must not resolve
 * to "no clamp" (which prints a whole note into a 240px rail), zero must render nothing at all
 * rather than an empty line's worth of padding, and the preview must never reach the icon-only
 * strips, where there is no room for it and no label to attach it to.
 */
/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { TopicDetail, type TopicDetailItem } from '../blocks/topic-detail'

const BODY = 'First line of the note.\nSecond line.'

function renderRail(item: Partial<TopicDetailItem>, collapsed = false) {
  const items: TopicDetailItem[] = [{ id: 'note', label: 'Standup', ...item }]
  return render(
    <TopicDetail items={items} selectedId={null} onSelect={() => {}} collapsed={collapsed}>
      <div>detail</div>
    </TopicDetail>,
  )
}

/** The preview node inside the one row, or null. */
function preview(): HTMLElement | null {
  return screen.getByRole('button', { name: /Standup/ }).querySelector('[data-htd-preview]')
}

afterEach(cleanup)

describe('TopicDetailItem.preview', () => {
  it('renders the text under the label, clamped to `previewLines`', () => {
    renderRail({ preview: BODY, previewLines: 2 })
    expect(preview()).toHaveClass('line-clamp-2')
    // `whitespace-pre-line`, not a run-on paragraph: a note previewed as one line reads
    // nothing like the note.
    expect(preview()).toHaveTextContent('First line of the note.')
    expect(preview()).toHaveClass('whitespace-pre-line')
  })

  it('defaults to one line when the row asks for a preview but no height', () => {
    renderRail({ preview: BODY })
    expect(preview()).toHaveClass('line-clamp-1')
  })

  it('renders nothing at zero lines', () => {
    // The "off" position of a user setting. A list keeps passing `preview` and lets the one
    // number carry the whole preference, so zero has to mean absent — not an empty node whose
    // margin still pushes every row taller.
    renderRail({ preview: BODY, previewLines: 0 })
    expect(preview()).toBeNull()
  })

  it('clamps a setting outside the supported range instead of dropping the clamp', () => {
    // No `line-clamp-9` class exists, so an untrusted 9 would render the entire note into a
    // 240px rail — the one failure that looks like a layout bug rather than a bad value.
    renderRail({ preview: BODY, previewLines: 9 })
    expect(preview()).toHaveClass('line-clamp-4')
    cleanup()

    renderRail({ preview: BODY, previewLines: -3 })
    expect(preview()).toBeNull()
  })

  it('ignores a preview that is only whitespace', () => {
    // An empty body still comes back as a string; a blank preview node is just a taller row.
    renderRail({ preview: '   \n  ', previewLines: 3 })
    expect(preview()).toBeNull()
  })

  it('stays out of the collapsed icon strip', () => {
    renderRail({ preview: BODY, previewLines: 3 }, true)
    // The label is already gone there — body text has neither the room nor anything to sit under.
    expect(preview()).toBeNull()
  })

  it('sits under an INLINE sublabel rather than replacing it', () => {
    // The two are different facts about the row (what it is filed under vs. what it says), so
    // opting into one must not cost the other.
    renderRail({ preview: BODY, previewLines: 2, sublabel: 'Work', inlineSublabel: true })
    const row = screen.getByRole('button', { name: /Standup/ })
    expect(row).toHaveTextContent('Work')
    expect(preview()).toHaveClass('line-clamp-2')
  })

  it('leaves a row that sets no preview exactly as it was', () => {
    renderRail({ sublabel: 'Work' })
    expect(preview()).toBeNull()
  })
})
