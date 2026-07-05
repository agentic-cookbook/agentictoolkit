/**
 * Unit tests for MarkdownSpellCheck — the off-by-default editor-toolbar control
 * that lints the markdown source via harper.js and lists problems in a popover.
 *
 * The real linter loads harper's WASM in a Web Worker, which jsdom cannot run, so
 * every test injects a fake `MarkdownLinter` via the `createLinter` DI seam. That
 * also lets us assert the lazy contract: harper is never reached until the toggle
 * is first enabled.
 */
import * as React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import {
  MarkdownSpellCheck,
  type MarkdownLinter,
  type SpellIssue,
} from '../components/markdown-spellcheck'

// A trivial fake linter: flags every "teh" as a misspelling of "the". Pure JS —
// no WASM, no worker.
function makeFakeLinter(): MarkdownLinter {
  const find = (source: string): SpellIssue[] => {
    const issues: SpellIssue[] = []
    const re = /teh/g
    let m: RegExpExecArray | null
    while ((m = re.exec(source)) !== null) {
      issues.push({
        start: m.index,
        end: m.index + 3,
        flagged: 'teh',
        message: 'Did you mean "the"?',
        suggestions: ['the'],
      })
    }
    return issues
  }
  return {
    async lint(source) {
      return find(source)
    },
    async apply(source, issueIndex, suggestionIndex) {
      const issue = find(source)[issueIndex]
      if (!issue) return source
      const replacement = issue.suggestions[suggestionIndex] ?? ''
      return source.slice(0, issue.start) + replacement + source.slice(issue.end)
    },
    dispose() {},
  }
}

function toggle(): HTMLElement {
  return screen.getByRole('button', { name: 'Check spelling' })
}

function Harness({ initial }: { initial: string }): React.ReactElement {
  const [value, setValue] = React.useState(initial)
  const createLinter = React.useMemo(() => makeFakeLinter, [])
  return (
    <>
      <MarkdownSpellCheck
        value={value}
        onApply={setValue}
        createLinter={createLinter}
        debounceMs={0}
      />
      <span data-testid="src">{value}</span>
    </>
  )
}

describe('MarkdownSpellCheck — toggle', () => {
  it('renders an off-by-default, labelled toggle and checks nothing until enabled', () => {
    render(
      <MarkdownSpellCheck
        value="teh cat"
        onApply={vi.fn()}
        createLinter={makeFakeLinter}
      />,
    )
    const btn = toggle()
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    // The panel (and any lint output) stays out of the DOM while off.
    expect(screen.queryByText('Did you mean "the"?')).toBeNull()
  })

  it('does not build the linter until the toggle is enabled (lazy)', async () => {
    const createLinter = vi.fn(makeFakeLinter)
    render(
      <MarkdownSpellCheck
        value="teh"
        onApply={vi.fn()}
        createLinter={createLinter}
        debounceMs={0}
      />,
    )
    expect(createLinter).not.toHaveBeenCalled()
    fireEvent.click(toggle())
    await waitFor(() => expect(createLinter).toHaveBeenCalledTimes(1))
  })
})

describe('MarkdownSpellCheck — linting', () => {
  it('lints the source and lists the problem when enabled', async () => {
    render(
      <MarkdownSpellCheck
        value="teh cat sat"
        onApply={vi.fn()}
        createLinter={makeFakeLinter}
        debounceMs={0}
      />,
    )
    fireEvent.click(toggle())
    expect(await screen.findByText('Did you mean "the"?')).toBeInTheDocument()
    expect(screen.getByText('teh')).toBeInTheDocument()
    // The toggle reflects the active state.
    expect(toggle()).toHaveAttribute('aria-pressed', 'true')
    // An apply-suggestion action is offered for the flagged text.
    expect(
      screen.getByRole('button', { name: /Replace .*teh.* with .*the.*/ }),
    ).toBeInTheDocument()
  })

  it('shows an empty state when the source is clean', async () => {
    render(
      <MarkdownSpellCheck
        value="the cat sat"
        onApply={vi.fn()}
        createLinter={makeFakeLinter}
        debounceMs={0}
      />,
    )
    fireEvent.click(toggle())
    expect(await screen.findByText('No issues found.')).toBeInTheDocument()
  })
})

describe('MarkdownSpellCheck — apply', () => {
  it('applies a suggestion and edits the source', async () => {
    render(<Harness initial="teh cat" />)
    fireEvent.click(toggle())
    const apply = await screen.findByRole('button', {
      name: /Replace .*teh.* with .*the.*/,
    })
    fireEvent.click(apply)
    await waitFor(() =>
      expect(screen.getByTestId('src')).toHaveTextContent('the cat'),
    )
  })
})
