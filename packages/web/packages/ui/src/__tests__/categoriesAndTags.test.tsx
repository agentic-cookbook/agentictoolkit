/**
 * `CategoriesAndTags` — the two classification rows as ONE block.
 *
 * What is worth asserting here is the composition and the wiring, not the pixels: that
 * both halves are the real shared fields (so a fix to either lands here), that each
 * reports its own edit without touching the other's value, and that the block sets the
 * shared label-column width the two captions align against. jsdom resolves no cascade,
 * so the alignment itself can only be checked as "both rows read the same variable".
 */
/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { CategoriesAndTags } from '../blocks/categories-and-tags'

function renderBlock(overrides?: {
  onCategoryChange?: (next: string) => void
  onTagsChange?: (next: string[]) => void
}) {
  return render(
    <CategoriesAndTags
      category={{
        label: 'Categories',
        noun: 'category',
        options: ['Agents', 'Retrieval'],
        value: 'Agents',
        onChange: overrides?.onCategoryChange ?? (() => {}),
      }}
      tags={{
        label: 'Tags',
        noun: 'tag',
        options: ['rag', 'evals'],
        value: ['rag'],
        onChange: overrides?.onTagsChange ?? (() => {}),
      }}
    />,
  )
}

afterEach(cleanup)

describe('CategoriesAndTags', () => {
  it('renders both rows, each with its own autocomplete and its own Choose… control', () => {
    renderBlock()
    expect(screen.getByText('Categories')).toBeInTheDocument()
    expect(screen.getByText('Tags')).toBeInTheDocument()
    // CategoryField names its combobox after the row; TagSetField names its "Add a <noun>".
    expect(screen.getByRole('combobox', { name: 'Categories' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Add a tag' })).toBeInTheDocument()
    // Both rows' "Choose…" trigger is an EntityChooser, whose `aria-label` (not its visible
    // "Choose…" text) is the button's accessible name: "Browse <label>" for CategoryField's
    // single-value chooser, and the row's own `label` for TagSetField's multi-value one.
    expect(screen.getByRole('button', { name: 'Browse categories' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tags' })).toBeInTheDocument()
  })

  it('renders no help text — the rows are self-evident and the hints were noise', () => {
    renderBlock()
    expect(screen.queryByText(/Type to autocomplete/)).toBeNull()
    expect(screen.queryByText(/^Optional —/)).toBeNull()
  })

  it('reports a category edit without disturbing the tags', () => {
    const onCategoryChange = vi.fn()
    const onTagsChange = vi.fn()
    renderBlock({ onCategoryChange, onTagsChange })
    // `@testing-library/user-event` is not a devDependency of this package (see
    // popupMenu.test.tsx) — `fireEvent.change` is this package's existing convention for
    // driving the Combobox's `onValueChange` (see categoryField.test.tsx, tagSetField.test.tsx).
    fireEvent.change(screen.getByRole('combobox', { name: 'Categories' }), {
      target: { value: 'R' },
    })
    expect(onCategoryChange).toHaveBeenCalled()
    expect(onTagsChange).not.toHaveBeenCalled()
  })

  it('publishes ONE label-column width for both rows to align against', () => {
    const { container } = renderBlock()
    const group = container.querySelector('[data-slot="categories-and-tags"]') as HTMLElement
    expect(group).not.toBeNull()
    expect(group.className).toContain('--apt-field-label-w')
  })

  it("renders each row's Field in the inline grid layout, not just the group's width variable", () => {
    // The group publishing `--apt-field-label-w` (above) is necessary but not sufficient —
    // it says nothing about whether `Field` actually consumed `layout="inline"`. This walks
    // up from the caption text to the real `<label>` (rendered by the shared `Label`
    // component `Field` wraps its content in) and asserts it carries the inline grid class,
    // so the test fails if `Field`'s inline branch is ever made a no-op.
    renderBlock()
    const categoriesLabel = screen.getByText('Categories').closest('label')
    expect(categoriesLabel).not.toBeNull()
    expect(categoriesLabel!.className).toContain('grid-cols-[var(--apt-field-label-w')

    const tagsLabel = screen.getByText('Tags').closest('label')
    expect(tagsLabel).not.toBeNull()
    expect(tagsLabel!.className).toContain('grid-cols-[var(--apt-field-label-w')
  })
})
