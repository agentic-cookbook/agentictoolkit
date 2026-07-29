/** DocArticle (HDV) — the .prose surface for pre-rendered document HTML. */

import * as React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'

import { DocArticle, DOC_ARTICLE_PROSE_CLASS } from '../blocks/doc-article'

describe('DocArticle', () => {
  it('renders the given HTML inside an <article>', () => {
    render(<DocArticle data-testid="doc" html="<h2 id='intro'>Intro</h2><p>Body</p>" />)
    const article = screen.getByTestId('doc')
    expect(article.tagName).toBe('ARTICLE')
    expect(article.querySelector('h2')!.id).toBe('intro')
    expect(article.textContent).toBe('IntroBody')
  })

  it('applies the prose contract verbatim — cn() must not rewrite it', () => {
    // The class list is the site's typography contract; twMerge collapsing or
    // reordering it would be a silent visual regression, so assert equality.
    render(<DocArticle data-testid="doc" html="" />)
    expect(screen.getByTestId('doc').className).toBe(DOC_ARTICLE_PROSE_CLASS)
  })

  it('keeps the prose contract when the host adds classes', () => {
    render(<DocArticle data-testid="doc" html="" className="mt-8" />)
    const className = screen.getByTestId('doc').className
    expect(className).toContain('prose-headings:scroll-mt-20')
    expect(className).toContain('mt-8')
  })

  it('can render as a non-article element for a fragment of a document', () => {
    render(<DocArticle data-testid="doc" as="div" html="<p>x</p>" />)
    expect(screen.getByTestId('doc').tagName).toBe('DIV')
  })
})
