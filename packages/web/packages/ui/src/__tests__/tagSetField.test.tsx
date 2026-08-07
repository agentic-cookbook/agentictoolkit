/** Unit tests for TagSetField — the shared tag-set row (autocomplete over a browse/add
 *  chooser). Two consumers depend on the commit rule encoded here (a research document's
 *  tags, a work item's labels), so these assert the RULE rather than either surface: what
 *  counts as accepting a suggestion, what a half-typed label does, and which control mints
 *  something new. The list/keyboard behaviour underneath is entityChooser/listChooser's. */
/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TagSetField } from '../blocks/tag-set-field'

const TAGS = ['attention', 'transformers', 'vision']

function renderField(value: string[], onChange = vi.fn(), options: string[] = TAGS) {
  render(
    <TagSetField label="Tags" noun="tag" options={options} value={value} onChange={onChange} />,
  )
  return onChange
}

describe('TagSetField — the autocomplete half', () => {
  it('adds a label when the typed text exactly matches the vocabulary', () => {
    const onChange = renderField([])
    fireEvent.change(screen.getByLabelText('Add a tag'), { target: { value: 'vision' } })
    expect(onChange).toHaveBeenCalledWith(['vision'])
  })

  it('appends to the set rather than replacing it', () => {
    const onChange = renderField(['attention'])
    fireEvent.change(screen.getByLabelText('Add a tag'), { target: { value: 'vision' } })
    expect(onChange).toHaveBeenCalledWith(['attention', 'vision'])
  })

  // A half-typed label is a SEARCH. Committing it would put fragments on the record every
  // time focus moved, which is the whole reason the typed text is local state.
  it('does not commit a partial match', () => {
    const onChange = renderField([])
    fireEvent.change(screen.getByLabelText('Add a tag'), { target: { value: 'visi' } })
    expect(onChange).not.toHaveBeenCalled()
  })

  // Worth stating rather than discovering: Enter on unknown text is far more often a typo than
  // an intent to invent a label, so minting is the chooser's explicit "add" row (below).
  it('does not mint a brand-new label from the autocomplete', () => {
    const onChange = renderField([])
    const input = screen.getByLabelText('Add a tag')
    fireEvent.change(input, { target: { value: 'diffusion' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
  })

  it('re-sending a label already on the set is inert', () => {
    const onChange = renderField(['vision'])
    fireEvent.change(screen.getByLabelText('Add a tag'), { target: { value: 'vision' } })
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('TagSetField — the chooser half', () => {
  it('renders the set as removable chips and takes one off', () => {
    const onChange = renderField(['attention', 'vision'])
    expect(screen.getByRole('button', { name: 'Remove attention' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Remove attention' }))
    expect(onChange).toHaveBeenCalledWith(['vision'])
  })

  it('mints a brand-new label from the chooser', () => {
    const onChange = renderField([])
    fireEvent.click(screen.getByRole('button', { name: 'Tags' }))
    // Both halves are comboboxes, so the browser's filter field is addressed by its own label.
    const input = screen.getByLabelText('Filter or add a tag') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'diffusion' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(['diffusion'])
  })
})

describe('TagSetField — words are the host’s', () => {
  it('builds every visible string from `label` and `noun`', () => {
    render(
      <TagSetField
        label="Labels"
        noun="label"
        options={TAGS}
        value={[]}
        onChange={vi.fn()}
      />,
    )
    // Nothing here hardcodes "tag": the row, the autocomplete and the chooser all name the
    // host's noun, which is what lets one component serve tags AND labels.
    expect(screen.getByLabelText('Add a label')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Labels' })).toBeInTheDocument()
    expect(screen.getByText('No labels yet')).toBeInTheDocument()
  })

  // The vocabulary is a SUGGESTION list, never a closed set — a label just minted here, or one
  // another surface added, has to keep rendering.
  it('shows a selected value that is not in the vocabulary', () => {
    renderField(['diffusion'])
    expect(screen.getByRole('button', { name: 'Remove diffusion' })).toBeInTheDocument()
  })
})
