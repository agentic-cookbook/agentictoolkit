/**
 * `Field` — the shared caption + control row, `layout="inline"` in particular.
 *
 * "Labels right-aligned in a shared column" is a stated requirement (see the component's own
 * docblock) with no assertion anywhere: jsdom resolves no layout, so a rendered-pixel test is
 * not possible here — but the WIRING that produces the alignment (the caption's own alignment
 * classes, and the footnote landing in the label's second grid column) is exactly what three
 * separate mutations (drop `justify-self-end`, drop the footnote's `col-start-2`, drop the
 * inline caption classes entirely) broke while `categoriesAndTags.test.tsx` — which never
 * passes `hint`/`error` through to a `Field`, so its `FieldFootnote` never even renders — stayed
 * green throughout. This file exercises `Field` directly instead.
 */
/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'

import { Field } from '../blocks/field'

afterEach(cleanup)

describe('Field — layout="inline"', () => {
  it('right-aligns the caption in the shared label column', () => {
    render(
      <Field label="Slug" layout="inline">
        <input aria-label="Slug" />
      </Field>,
    )
    const caption = screen.getByText('Slug')
    expect(caption).toHaveClass('justify-self-end')
    expect(caption).toHaveClass('text-right')
  })

  it('puts the footnote in the second grid column, alongside the control', () => {
    render(
      <Field label="Slug" layout="inline" hint="Lowercase letters, numbers and dashes only.">
        <input aria-label="Slug" />
      </Field>,
    )
    const footnote = screen.getByText('Lowercase letters, numbers and dashes only.')
    expect(footnote).toHaveClass('col-start-2')
  })
})

describe('Field — layout="stacked" (the default)', () => {
  it('does NOT right-align the caption — inline alignment is specific to the inline layout', () => {
    render(
      <Field label="Slug">
        <input aria-label="Slug" />
      </Field>,
    )
    const caption = screen.getByText('Slug')
    expect(caption).not.toHaveClass('justify-self-end')
    expect(caption).not.toHaveClass('text-right')
  })

  it('does not pin the footnote to a grid column it does not have', () => {
    render(
      <Field label="Slug" hint="A hint.">
        <input aria-label="Slug" />
      </Field>,
    )
    expect(screen.getByText('A hint.')).not.toHaveClass('col-start-2')
  })
})
