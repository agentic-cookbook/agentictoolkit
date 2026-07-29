/** HierarchicalDocumentView + DocPage (HDV) — the reader's three-column frame.
 *  Slots only, so what there is to assert is the geometry: which element wraps
 *  what, in what order, with which classes. Those classes came out of the
 *  cookbook site, and the extraction is a move — a change here is a bug. */

import * as React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import {
  DocPage,
  DOC_PAGE_ARTICLE_CLASS,
  DOC_PAGE_CLASS,
  HIERARCHICAL_DOCUMENT_VIEW_CLASS,
  HIERARCHICAL_DOCUMENT_VIEW_CONTENT_CLASS,
  HierarchicalDocumentView,
} from '../blocks/hierarchical-document-view'

describe('HierarchicalDocumentView', () => {
  it('puts the nav first and the content region after it', () => {
    const { container } = render(
      <HierarchicalDocumentView nav={<aside data-testid="nav">tree</aside>}>
        <p>document</p>
      </HierarchicalDocumentView>,
    )

    const root = container.firstElementChild!
    expect(root.className).toBe(HIERARCHICAL_DOCUMENT_VIEW_CLASS)
    expect(root.children).toHaveLength(2)
    expect(root.children[0]!).toBe(screen.getByTestId('nav'))
    expect(root.children[1]!.className).toBe(
      HIERARCHICAL_DOCUMENT_VIEW_CONTENT_CLASS,
    )
    expect(root.children[1]!.textContent).toBe('document')
  })

  it('renders the nav unwrapped, so it keeps its own sticky column', () => {
    render(
      <HierarchicalDocumentView nav={<aside data-testid="nav">tree</aside>}>
        x
      </HierarchicalDocumentView>,
    )
    // Not nested in a positioning div of ours — `sticky` resolves against the
    // frame, which is what makes the column hold while the document scrolls.
    expect(screen.getByTestId('nav').parentElement!.className).toBe(
      HIERARCHICAL_DOCUMENT_VIEW_CLASS,
    )
  })

  it('drops the column entirely when there is no nav', () => {
    const { container } = render(
      <HierarchicalDocumentView>
        <p>document</p>
      </HierarchicalDocumentView>,
    )
    const root = container.firstElementChild!
    expect(root.children).toHaveLength(1)
    expect(root.children[0]!.className).toBe(
      HIERARCHICAL_DOCUMENT_VIEW_CONTENT_CLASS,
    )
  })

  it('never renders a main landmark — the host app shell owns that one', () => {
    const { container } = render(
      <HierarchicalDocumentView nav={<nav>tree</nav>}>x</HierarchicalDocumentView>,
    )
    expect(container.querySelector('main')).toBeNull()
    expect(screen.queryByRole('main')).toBeNull()
  })

  it('merges a host class onto the frame instead of replacing it', () => {
    const { container } = render(
      <HierarchicalDocumentView className="gap-4">x</HierarchicalDocumentView>,
    )
    const root = container.firstElementChild!
    expect(root.className).toContain('flex-1')
    expect(root.className).toContain('gap-4')
  })

  it('forwards the rest of its props to the frame', () => {
    const { container } = render(
      <HierarchicalDocumentView id="reader" data-thing="x">
        y
      </HierarchicalDocumentView>,
    )
    const root = container.firstElementChild!
    expect(root.id).toBe('reader')
    expect(root.getAttribute('data-thing')).toBe('x')
  })
})

describe('DocPage', () => {
  it('wraps the document in the measure, then puts the rail beside it', () => {
    const { container } = render(
      <DocPage toc={<aside data-testid="toc">on this page</aside>}>
        <p>document</p>
      </DocPage>,
    )

    const root = container.firstElementChild!
    expect(root.className).toBe(DOC_PAGE_CLASS)
    expect(root.children).toHaveLength(2)
    expect(root.children[0]!.className).toBe(DOC_PAGE_ARTICLE_CLASS)
    expect(root.children[0]!.textContent).toBe('document')
    // After the article: the rail reads as a supplement, not a second nav.
    expect(root.children[1]!).toBe(screen.getByTestId('toc'))
  })

  it('holds the measure that makes the prose readable', () => {
    // The reason the block exists. Prose running a 1440px window is unreadable,
    // and `min-w-0` is what stops a wide code block from pushing the rail off.
    expect(DOC_PAGE_ARTICLE_CLASS).toContain('max-w-3xl')
    expect(DOC_PAGE_ARTICLE_CLASS).toContain('min-w-0')
  })

  it('keeps the article column when there is no rail', () => {
    const { container } = render(
      <DocPage>
        <p>document</p>
      </DocPage>,
    )
    const root = container.firstElementChild!
    expect(root.children).toHaveLength(1)
    expect(root.children[0]!.className).toBe(DOC_PAGE_ARTICLE_CLASS)
  })

  it('renders the rail unwrapped, so it keeps its own sticky column', () => {
    render(<DocPage toc={<aside data-testid="toc">x</aside>}>y</DocPage>)
    expect(screen.getByTestId('toc').parentElement!.className).toBe(
      DOC_PAGE_CLASS,
    )
  })

  it('merges a host class onto the row and forwards the rest', () => {
    const { container } = render(
      <DocPage className="items-start" id="doc">
        x
      </DocPage>,
    )
    const root = container.firstElementChild!
    expect(root.className).toContain('flex')
    expect(root.className).toContain('items-start')
    expect(root.id).toBe('doc')
  })

  it('nests inside the view without either frame touching the other', () => {
    const { container } = render(
      <HierarchicalDocumentView nav={<aside data-testid="nav">tree</aside>}>
        <DocPage toc={<aside data-testid="toc">rail</aside>}>
          <p>document</p>
        </DocPage>
      </HierarchicalDocumentView>,
    )

    // nav → content → row → article → prose, and the rail beside the article.
    const content = container.firstElementChild!.children[1]!
    const row = content.firstElementChild!
    expect(row.className).toBe(DOC_PAGE_CLASS)
    expect(row.children[0]!.textContent).toBe('document')
    expect(screen.getByTestId('toc').parentElement!).toBe(row)
    expect(screen.getByTestId('nav').parentElement!).toBe(
      container.firstElementChild!,
    )
  })
})
