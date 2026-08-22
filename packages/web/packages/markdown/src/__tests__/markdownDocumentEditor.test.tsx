// @vitest-environment jsdom
//
// MarkdownDocumentEditor — the shared document editing view: a body editor, a preview of the
// SAME render the published page uses, and two layouts.
//
// `MarkdownRenderer` is mocked to a synchronous stand-in. The real one runs unified + shiki,
// which is slow, async, and already covered by process-markdown.test.ts; what is under test
// here is which panes exist in which layout, which is exactly what a real renderer would
// obscure behind a "Rendering…" phase.
//
// The wide/narrow gate is `window.matchMedia`, which the shared setup stubs to a permanent
// `matches: false` (i.e. narrow). Tests that want the wide strip install their own stub, so
// the DEFAULT here is a phone — which is the case the spec is strictest about.
//
// This is the package's only DOM test file, so it is also the only place the jest-dom
// matcher types need to be pulled in (ui's test files do the same per-file, since the
// augmentation is program-wide once any file references it).
/// <reference types="@testing-library/jest-dom/vitest" />
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor, fireEvent, act } from '@testing-library/react'
import { useState } from 'react'

vi.mock('../components/MarkdownRenderer', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => <div data-testid="rendered">{content}</div>,
}))

import { MarkdownDocumentEditor } from '../components/MarkdownDocumentEditor'

function setViewport(matches: boolean) {
  window.matchMedia = ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

function Harness(props: { initial?: string; defaultLayout?: 'tabbed' | 'split' }) {
  const [value, setValue] = useState(props.initial ?? '# Hello')
  return (
    <MarkdownDocumentEditor
      value={value}
      onChange={setValue}
      defaultLayout={props.defaultLayout}
      header={<div data-testid="header">identity</div>}
    />
  )
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  setViewport(false)
})
afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe('MarkdownDocumentEditor — narrow', () => {
  it('offers Edit and Preview, and no layout choice at all', () => {
    render(<Harness />)
    expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^preview$/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /side by side/i })).toBeNull()
  })

  it('shows the editor first and swaps to the preview on the Preview tab', async () => {
    const { container } = render(<Harness />)
    // The tabbed (narrow, default) layout opens on the edit pane — the textbox must actually
    // be present here, not just absent later. Mutating `showEditor` to `effective === 'split'`
    // deletes this entire phone/tabbed edit view while every other assertion in this file
    // still passes, since nothing else positively checks for the textbox outside the split.
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(container.querySelector('[data-slot="markdown-preview"]')).toBeNull()
    screen.getByRole('button', { name: /^preview$/i }).click()
    await waitFor(() =>
      expect(container.querySelector('[data-slot="markdown-preview"]')).not.toBeNull(),
    )
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('renders the header above the strip', () => {
    render(<Harness />)
    expect(screen.getByTestId('header')).toBeInTheDocument()
  })

  it('renders an overlay inside the editor pane, positioned against it', () => {
    render(
      <MarkdownDocumentEditor
        value="hi"
        onChange={() => {}}
        overlay={<div data-testid="mentions">@…</div>}
      />,
    )
    const overlay = screen.getByTestId('mentions')
    // Not merely "on the page": a typeahead listbox is absolutely positioned, so it is only
    // correct if its offset parent is the pane it belongs to.
    expect(overlay.parentElement).toHaveClass('relative')
    expect(overlay.parentElement).toContainElement(screen.getByRole('textbox'))
  })

  it('does not render the overlay over the preview', async () => {
    render(
      <MarkdownDocumentEditor
        value="hi"
        onChange={() => {}}
        overlay={<div data-testid="mentions">@…</div>}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /preview/i }))
    expect(screen.queryByTestId('mentions')).toBeNull()
  })

  it('lets a host size the preview pane', () => {
    render(
      <MarkdownDocumentEditor value="hi" onChange={() => {}} previewClassName="min-h-[12rem]" />,
    )
    fireEvent.click(screen.getByRole('button', { name: /preview/i }))
    expect(document.querySelector('[data-slot="markdown-preview"]')).toHaveClass('min-h-[12rem]')
  })

  it('collapses a `split` preference to tabbed on a phone — side-by-side is never available narrow', () => {
    // The narrow tests above only ever exercise the DEFAULT layout (`tabbed`), where the
    // `wide ? layout : 'tabbed'` collapse is a no-op — mutating it to just `layout` still left
    // every one of them green. Requesting `split` while narrow is the only render that can
    // actually observe the collapse.
    const { container } = render(<Harness defaultLayout="split" />)
    // Tabbed: exactly one pane mounted at a time, and the tab buttons exist at all (the split
    // layout drops them entirely — see the "wide" describe block below).
    expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^preview$/i })).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(container.querySelector('[data-slot="markdown-preview"]')).toBeNull()
  })

  it('points both pane-chooser buttons at a real element, in either tab state', () => {
    render(<Harness />)
    const editBtn = screen.getByRole('button', { name: /^edit$/i })
    const previewBtn = screen.getByRole('button', { name: /^preview$/i })

    // Same target for both — there is exactly one pane container, not one per pane.
    const target = editBtn.getAttribute('aria-controls')
    expect(target).toBeTruthy()
    expect(previewBtn.getAttribute('aria-controls')).toBe(target)

    // Checked in the EDIT tab state (the default)...
    expect(document.getElementById(target as string)).not.toBeNull()

    // ...and again after switching to Preview. Only one pane is ever mounted in tabbed mode,
    // so a per-pane id would resolve here and dangle there (or vice versa); the container is
    // what has to keep resolving across the switch.
    fireEvent.click(previewBtn)
    expect(document.getElementById(target as string)).not.toBeNull()
  })
})

describe('MarkdownDocumentEditor — wide', () => {
  beforeEach(() => setViewport(true))

  it('offers the layout choice alongside the pane tabs', () => {
    render(<Harness />)
    expect(screen.getByRole('button', { name: /single tabbed view/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /side by side view/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument()
  })

  it('shows both panes at once in the split, and drops the now-meaningless pane tabs', async () => {
    const { container } = render(<Harness defaultLayout="split" />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    await waitFor(() =>
      expect(container.querySelector('[data-slot="markdown-preview"]')).not.toBeNull(),
    )
    expect(screen.queryByRole('button', { name: /^edit$/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^preview$/i })).toBeNull()
  })

  it('previews the current text once typing settles', async () => {
    render(<Harness initial="# Live" defaultLayout="split" />)
    await waitFor(() => expect(screen.getByTestId('rendered')).toHaveTextContent('# Live'))

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '# Updated' } })

    // Not yet — the preview must still show the pre-edit text until the debounce elapses
    // (PREVIEW_DEBOUNCE_MS in the component is 300ms). Catches an undebounced (immediate)
    // update.
    act(() => void vi.advanceTimersByTime(299))
    expect(screen.getByTestId('rendered')).toHaveTextContent('# Live')

    // Now the debounce has elapsed — the preview must have updated. Catches a debounce that
    // never fires at all (a permanently stale preview).
    act(() => void vi.advanceTimersByTime(1))
    expect(screen.getByTestId('rendered')).toHaveTextContent('# Updated')
  })
})
