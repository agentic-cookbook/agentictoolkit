import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SourceCodePanel } from '../SourceCodePanel'

/*
 * The actual Shiki highlight runs async (loads WASM + grammar). In jsdom
 * we exercise the synchronous parts: the fallback <pre> renders the raw
 * code while loading, the filename header / copy button are wired, and
 * showCopy=false hides the chrome. The Shiki output is a thin glue layer
 * over `codeToHtml` and is covered by Shiki's own tests.
 */

describe('SourceCodePanel', () => {
  it('renders the raw code in the fallback pre while loading', () => {
    render(<SourceCodePanel code={"const x = 1"} lang="ts" />)
    expect(screen.getByText('const x = 1')).toBeTruthy()
  })

  it('shows the filename in the header when provided', () => {
    render(<SourceCodePanel code={"x"} filename="example.ts" />)
    expect(screen.getByText('example.ts')).toBeTruthy()
  })

  it('falls back to lang as the header label when no filename', () => {
    render(<SourceCodePanel code={"x"} lang="json" />)
    expect(screen.getByText('json')).toBeTruthy()
  })

  it('hides the header entirely when showCopy=false and no filename', () => {
    const { container } = render(<SourceCodePanel code={"x"} lang="ts" showCopy={false} />)
    expect(container.querySelector('.scp-header')).toBeNull()
  })

  it('copies code via clipboard.writeText when Copy is clicked', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    render(<SourceCodePanel code={"hello"} />)
    fireEvent.click(screen.getByText('Copy'))
    expect(writeText).toHaveBeenCalledWith('hello')
  })
})
