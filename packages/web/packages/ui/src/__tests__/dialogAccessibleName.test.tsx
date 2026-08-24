/**
 * Every modal announces itself BY ITS HEADING.
 *
 * A dialog with no accessible name is announced as an unnamed dialog: a screen-reader user
 * lands inside a trap with no idea what asked for their attention, and the visible heading
 * that would have told them is right there, unwired. `.claude/skills/project-guidelines/
 * topics/ui-development.md` requires the name; these assert it end to end — the popup's
 * `aria-labelledby` must RESOLVE to the heading's own text, not merely be present.
 *
 * The wiring itself is Base UI's: `DialogTitle` registers its id with the popup, so any modal
 * composed from `Dialog` + `DialogContent` + `DialogTitle` is named for free. That is exactly
 * why this file asserts the RESULT rather than the composition — the guarantee is the name,
 * and a modal that grew a bespoke heading instead of `DialogTitle` should fail here.
 */
/// <reference types="@testing-library/jest-dom/vitest" />
import { render, cleanup } from '@testing-library/react'
import { describe, it, expect, afterEach, vi } from 'vitest'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/dialog'
import { AlertModal } from '../components/alert-modal'
import { CategoryRenameDialog } from '../blocks/category-rename-dialog'
import { CategoryPickerDialog } from '../blocks/category-picker-dialog'
import { CategoryDeleteDialog } from '../blocks/category-delete-dialog'
import type { CategoryTreeNode } from '../blocks/category-tree'

const NODE: CategoryTreeNode = { id: 'c1', name: 'Architecture', parentIds: [] }

/** The accessible name the platform would compute for the one open dialog. */
function dialogName(): string | null {
  const popup = document.querySelector('[role="dialog"]') as HTMLElement | null
  if (!popup) return null
  const label = popup.getAttribute('aria-label')
  if (label) return label
  const id = popup.getAttribute('aria-labelledby')
  if (!id) return null
  return document.getElementById(id)?.textContent ?? null
}

afterEach(cleanup)

describe('modal accessible names', () => {
  it('names a dialog composed from Dialog + DialogTitle after its heading', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New category</DialogTitle>
          </DialogHeader>
          <p>body</p>
        </DialogContent>
      </Dialog>,
    )
    expect(dialogName()).toBe('New category')
  })

  it('names an AlertModal after its title', () => {
    render(<AlertModal open title="Discard changes?" onConfirm={vi.fn()} />)
    expect(dialogName()).toBe('Discard changes?')
  })

  it('names the category RENAME modal', () => {
    render(
      <CategoryRenameDialog
        open
        node={NODE}
        nodes={[NODE]}
        noun="category"
        onRename={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    expect(dialogName()).toBe('Rename category')
  })

  it('names the category MOVE modal after the category being moved', () => {
    render(
      <CategoryPickerDialog
        open
        nodes={[NODE]}
        title="Move “Architecture”"
        confirmLabel="Move"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(dialogName()).toBe('Move “Architecture”')
  })

  it('names the category DELETE modal after the category being deleted', () => {
    render(
      <CategoryDeleteDialog
        open
        node={NODE}
        itemNoun="documents"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(dialogName()).toBe('Delete “Architecture”?')
  })
})
