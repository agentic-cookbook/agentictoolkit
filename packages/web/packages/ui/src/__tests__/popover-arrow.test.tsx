import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { Popover, PopoverTrigger, PopoverContent } from '../components/popover'

// The popup is portalled and absent from the DOM while closed, so every assertion
// here opens it first — the same shape header-contract.test.tsx uses.
function openPopover(arrow?: boolean) {
  render(
    <Popover>
      <PopoverTrigger>Open</PopoverTrigger>
      <PopoverContent arrow={arrow}>Body</PopoverContent>
    </Popover>,
  )
  fireEvent.click(screen.getByText('Open'))
}

describe('PopoverContent arrow', () => {
  it('renders no arrow by default, so existing consumers keep their look', async () => {
    openPopover()
    await waitFor(() => expect(screen.getByText('Body')).toBeInTheDocument())
    expect(document.querySelector('[data-slot="popover-arrow"]')).toBeNull()
  })

  it('renders the arrow when asked', async () => {
    openPopover(true)
    await waitFor(() => expect(screen.getByText('Body')).toBeInTheDocument())
    expect(document.querySelector('[data-slot="popover-arrow"]')).not.toBeNull()
  })
})
