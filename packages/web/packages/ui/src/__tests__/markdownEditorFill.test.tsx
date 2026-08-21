/**
 * `MarkdownEditor.fill` — the editor takes the height it is given.
 *
 * `rows` is a CONTENT height: it says how tall the box is regardless of the window, which
 * is exactly wrong for a full-pane editor and for a side-by-side half. Filling swaps the
 * fixed height for a flex chain and turns the manual resize grip off, since the height is
 * no longer the user's to set.
 */
/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach } from 'vitest'
import { MarkdownEditor } from '../blocks/markdown-editor'

afterEach(cleanup)

describe('MarkdownEditor fill', () => {
  it('sets a rows attribute by default', () => {
    render(<MarkdownEditor value="" onChange={() => {}} label="Body" />)
    expect(screen.getByLabelText('Body')).toHaveAttribute('rows', '16')
  })

  it('drops rows and flexes the textarea when filling', () => {
    render(<MarkdownEditor value="" onChange={() => {}} label="Body" fill />)
    const textarea = screen.getByLabelText('Body')
    expect(textarea).not.toHaveAttribute('rows')
    expect(textarea.className).toContain('flex-1')
    expect(textarea.className).toContain('resize-none')
  })
})
