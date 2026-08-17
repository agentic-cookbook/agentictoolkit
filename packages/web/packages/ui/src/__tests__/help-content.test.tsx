import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  HelpContentProvider,
  useHelpEntry,
  type SiteHelp,
} from '../components/help-content'

function Probe({ id }: { id: string }) {
  const entry = useHelpEntry(id)
  return <span data-testid="probe">{entry ? entry.body : 'none'}</span>
}

const help: SiteHelp = { 'site-title': { body: 'What this site is for.' } }

afterEach(() => vi.restoreAllMocks())

describe('help content', () => {
  it('resolves an entry by id', () => {
    render(
      <HelpContentProvider help={help}>
        <Probe id="site-title" />
      </HelpContentProvider>,
    )
    expect(screen.getByTestId('probe')).toHaveTextContent('What this site is for.')
  })

  it('returns undefined for an unknown id', () => {
    render(
      <HelpContentProvider help={help}>
        <Probe id="nope" />
      </HelpContentProvider>,
    )
    expect(screen.getByTestId('probe')).toHaveTextContent('none')
  })

  it('returns undefined with no provider at all, rather than throwing', () => {
    render(<Probe id="site-title" />)
    expect(screen.getByTestId('probe')).toHaveTextContent('none')
  })

  // `SiteHelp` is a hand-written object literal in a site config, so it inherits
  // Object.prototype. A bare `help[id]` answers these ids with a function, which
  // <HelpEnabled> would take for an entry and render a popover out of undefined
  // copy instead of reporting the id as unknown.
  it.each(['constructor', 'toString', 'hasOwnProperty', '__proto__'])(
    'treats the inherited %s as an unknown id',
    (id) => {
      render(
        <HelpContentProvider help={help}>
          <Probe id={id} />
        </HelpContentProvider>,
      )
      expect(screen.getByTestId('probe')).toHaveTextContent('none')
    },
  )
})
