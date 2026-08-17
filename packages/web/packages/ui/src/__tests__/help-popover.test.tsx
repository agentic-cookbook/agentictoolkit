import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Popover, PopoverTrigger } from '../components/popover'
import { HelpPopoverContent } from '../components/help-popover'
import type { HelpEntry } from '../components/help-content'

async function open(entry: HelpEntry) {
  render(
    <Popover>
      <PopoverTrigger>Open</PopoverTrigger>
      <HelpPopoverContent entry={entry} />
    </Popover>,
  )
  fireEvent.click(screen.getByText('Open'))
  await waitFor(() => expect(screen.getByText(entry.body)).toBeInTheDocument())
}

describe('HelpPopoverContent', () => {
  it('renders the body and defaults to the info flavor', async () => {
    await open({ body: 'What this site is for.' })
    expect(document.querySelector('[data-help-flavor="info"]')).not.toBeNull()
  })

  it('renders the title when there is one', async () => {
    await open({ title: 'Cookbook', body: 'Recipes.' })
    expect(screen.getByText('Cookbook')).toBeInTheDocument()
  })

  it('renders no title node when there is none', async () => {
    await open({ body: 'Recipes.' })
    expect(document.querySelector('[data-slot="help-popover-title"]')).toBeNull()
  })

  it('renders a distinct icon per flavor', async () => {
    await open({ body: 'Brand new.', flavor: 'new' })
    expect(document.querySelector('[data-help-flavor="new"]')).not.toBeNull()
    expect(document.querySelector('[data-help-flavor="info"]')).toBeNull()
  })

  // The panel is a `role="dialog"` (Base UI hard-wires it on Popup) and derives a
  // name only from a Popover.Title/Description descendant, which this renders
  // neither of. Assert the name on the DIALOG, not on the icon: the flavor is the
  // only thing saying what the popover is for, so an unnamed dialog loses it.
  it('names the dialog after the flavor', async () => {
    await open({ body: 'Brand new.', flavor: 'new' })
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', "What's new")
  })

  it('qualifies the dialog name with the title when there is one', async () => {
    await open({ title: 'Cookbook', body: 'Recipes.', flavor: 'help' })
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Help: Cookbook')
  })

  // The same words are already the dialog's name, so labelling the icon too would
  // announce the flavor twice on open.
  it('leaves the icon out of the accessibility tree', async () => {
    await open({ body: 'Recipes.' })
    expect(document.querySelector('[data-help-flavor="info"]')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
  })
})
