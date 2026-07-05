/**
 * Unit tests for MarkdownEditor (blocks) — the labelled body textarea + the
 * editor toolbar (built-in upload + quick-reference controls + an extras slot).
 * Uses the real EditorToolbar / MarkdownQuickReference / Popover (base-ui).
 */
import * as React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { MarkdownEditor } from '../blocks/markdown-editor'

function ControlledEditor({
  initial = '',
  ...rest
}: { initial?: string } & Partial<
  Omit<React.ComponentProps<typeof MarkdownEditor>, 'value' | 'onChange'>
> = {}): React.ReactElement {
  const [value, setValue] = React.useState(initial)
  return <MarkdownEditor value={value} onChange={setValue} {...rest} />
}

describe('MarkdownEditor — body textarea', () => {
  it('labels the textarea with the default "Markdown body" caption', () => {
    render(<MarkdownEditor value="" onChange={vi.fn()} />)
    const textarea = screen.getByLabelText('Markdown body')
    expect(textarea.tagName).toBe('TEXTAREA')
  })

  it('uses a custom label as the textarea accessible name', () => {
    render(<MarkdownEditor value="" onChange={vi.fn()} label="Notes" />)
    expect(screen.getByLabelText('Notes').tagName).toBe('TEXTAREA')
  })

  it('reports the typed value via onChange', () => {
    const onChange = vi.fn()
    render(<MarkdownEditor value="" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Markdown body'), {
      target: { value: '# Title' },
    })
    expect(onChange).toHaveBeenCalledWith('# Title')
  })

  it('renders the controlled value and turns spell-check off by default', () => {
    render(<MarkdownEditor value="hello" onChange={vi.fn()} />)
    const textarea = screen.getByLabelText('Markdown body') as HTMLTextAreaElement
    expect(textarea.value).toBe('hello')
    expect(textarea).toHaveAttribute('spellcheck', 'false')
  })

  it('disables the textarea when disabled', () => {
    render(<MarkdownEditor value="" onChange={vi.fn()} disabled />)
    expect(screen.getByLabelText('Markdown body')).toBeDisabled()
  })
})

describe('MarkdownEditor — toolbar', () => {
  it('exposes a role="toolbar" with the default accessible name', () => {
    render(<MarkdownEditor value="" onChange={vi.fn()} />)
    expect(
      screen.getByRole('toolbar', { name: 'Markdown editor toolbar' }),
    ).toBeInTheDocument()
  })

  it('shows the quick-reference control by default', () => {
    render(<MarkdownEditor value="" onChange={vi.fn()} />)
    expect(
      screen.getByRole('button', { name: 'Markdown quick reference' }),
    ).toBeInTheDocument()
  })

  it('omits the quick-reference control when quickReference={false}', () => {
    render(<MarkdownEditor value="" onChange={vi.fn()} quickReference={false} />)
    expect(
      screen.queryByRole('button', { name: 'Markdown quick reference' }),
    ).toBeNull()
  })

  it('omits the toolbar entirely when there are no controls', () => {
    render(
      <MarkdownEditor value="" onChange={vi.fn()} quickReference={false} />,
    )
    expect(screen.queryByRole('toolbar')).toBeNull()
  })

  it('renders extra toolbar controls from the slot', () => {
    render(
      <MarkdownEditor
        value=""
        onChange={vi.fn()}
        toolbarExtras={<button type="button">Spell check</button>}
      />,
    )
    expect(screen.getByRole('button', { name: 'Spell check' })).toBeInTheDocument()
  })
})

describe('MarkdownEditor — upload control', () => {
  it('renders the Upload .md control only when onUpload is provided', () => {
    const { rerender } = render(<MarkdownEditor value="" onChange={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /Upload \.md/ })).toBeNull()
    rerender(<MarkdownEditor value="" onChange={vi.fn()} onUpload={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Upload \.md/ })).toBeInTheDocument()
  })

  it('reads a chosen file and reports its text + name via onUpload', async () => {
    const onUpload = vi.fn()
    render(<MarkdownEditor value="" onChange={vi.fn()} onUpload={onUpload} />)
    // The hidden native input is the only way to pick a file; it is sr-only.
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['# Hello'], 'notes.md', { type: 'text/markdown' })
    // jsdom's File.text() resolves the contents.
    fireEvent.change(input, { target: { files: [file] } })
    await waitFor(() => expect(onUpload).toHaveBeenCalledWith('# Hello', 'notes.md'))
  })
})

describe('MarkdownEditor — controlled round-trip', () => {
  it('reflects edits back into the textarea', () => {
    render(<ControlledEditor />)
    const textarea = screen.getByLabelText('Markdown body') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'edited' } })
    expect(textarea.value).toBe('edited')
  })
})
