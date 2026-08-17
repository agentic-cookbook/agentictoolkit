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

  // jsdom resolves no cascade, so which rule WINS is untestable here. What is
  // testable is that a rule exists for each side at all: `side` is a public prop
  // with four legal values, and a side with no rule leaves the diamond unrotated
  // and un-nudged — centred inside the popup, pointing the wrong way. Two of the
  // four were missing when this was written.
  it('carries a position and a rotation for all four sides', async () => {
    openPopover(true)
    await waitFor(() => expect(screen.getByText('Body')).toBeInTheDocument())
    const cls = document.querySelector('[data-slot="popover-arrow"]')!.className
    for (const side of ['top', 'bottom', 'left', 'right']) {
      expect(cls).toMatch(new RegExp(`data-\\[side=${side}\\]:-(top|bottom|left|right)-1`))
      expect(cls).toMatch(new RegExp(`data-\\[side=${side}\\]:rotate-`))
    }
  })
})
