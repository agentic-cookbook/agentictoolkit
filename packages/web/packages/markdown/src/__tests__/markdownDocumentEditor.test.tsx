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
