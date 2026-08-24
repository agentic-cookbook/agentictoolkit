/**
 * The delete dialog's description survives the browser's parser.
 *
 * `AlertModal` renders whatever `description` it is handed inside `DialogDescription`, and
 * Base UI renders that as a `<p>`. A `<p>` may not nest inside a `<p>`: the HTML parser closes
 * the outer one at the inner one's start tag and re-parents everything after it as a SIBLING.
 * So a `<p>` in here does not merely log a hydration warning — it evicts the dialog's own copy
 * from the element the popup's `aria-describedby` points at, and a screen-reader user is asked
 * to confirm a destructive action with the sentence that explains it no longer part of the
 * description. jsdom's parser is not involved in React rendering, so the eviction itself is
 * invisible here; what IS checkable, and what these assert, is the precondition for it.
 */
/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach, vi } from 'vitest'

import { CategoryDeleteDialog } from '../blocks/category-delete-dialog'
import type { CategoryTreeNode } from '../blocks/category-tree'

const NODE: CategoryTreeNode = { id: 'c1', name: 'Architecture', parentIds: [] }

/** Render the dialog in its FULLEST state — every one of the three description children
 *  present at once, which is the only arrangement that can exhibit all the nesting. */
function renderFull(): HTMLElement {
  render(
    <CategoryDeleteDialog
      open
      node={NODE}
      orphanedNames={['Edge Systems', 'Protocols']}
      itemNoun="documents"
      error="Category is in use."
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
    />,
  )
  const description = document.querySelector('[data-slot="dialog-description"]')
  expect(description).not.toBeNull()
  return description as HTMLElement
}

afterEach(cleanup)

describe('CategoryDeleteDialog — nothing inside the description may be a <p>', () => {
  it('renders no <p> descendant, with the warning and the error both present', () => {
    const description = renderFull()
    expect(description.querySelectorAll('p')).toHaveLength(0)
  })

  it('puts the error INSIDE the description rather than beside it', () => {
    const description = renderFull()
    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent('Category is in use.')
    expect(description.contains(alert)).toBe(true)
    expect(alert.tagName).toBe('SPAN')
  })

  // Each child still occupies its own line: `block` is what replaces the `<p>`'s line box,
  // and a run-on paragraph would be a different (visible) defect from the one being fixed.
  it('keeps every description child block-displayed', () => {
    const description = renderFull()
    const children = Array.from(description.children) as HTMLElement[]
    expect(children).toHaveLength(3)
    for (const child of children) expect(child.className).toContain('block')
  })

  // The copy is spec-mandated and was verified in the browser; the fix is markup only.
  it('does not alter the visible copy', () => {
    const description = renderFull()
    const text = description.textContent ?? ''
    expect(text).toContain(
      'This deletes the category only. Any documents filed under it are not deleted — they become uncategorized.',
    )
    expect(text).toContain(
      'These subcategories are filed nowhere else, so they are deleted too: Edge Systems, Protocols. Their documents become uncategorized as well.',
    )
  })

  it('uses the singular sentence for exactly one orphan', () => {
    render(
      <CategoryDeleteDialog
        open
        node={NODE}
        orphanedNames={['Protocols']}
        itemNoun="notes"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    const description = document.querySelector('[data-slot="dialog-description"]') as HTMLElement
    expect(description.textContent).toContain(
      'This subcategory is filed nowhere else, so it is deleted too: Protocols.',
    )
    expect(description.querySelectorAll('p')).toHaveLength(0)
  })
})
