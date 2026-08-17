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
})
