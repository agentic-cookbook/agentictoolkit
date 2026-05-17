import { describe, it, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { AppearanceModeToggle } from '../AppearanceModeToggle'
import { ColorModeProvider } from '@agentic-web-toolkit/themes/colorMode'

describe('AppearanceModeToggle', () => {
  it('renders a button with the awt-appearance-mode-toggle class', () => {
    const { container } = render(
      <ColorModeProvider>
        <AppearanceModeToggle />
      </ColorModeProvider>,
    )
    const btn = container.querySelector('.awt-appearance-mode-toggle')
    expect(btn).not.toBeNull()
    expect(btn?.tagName).toBe('BUTTON')
  })

  it('exposes an aria-label that changes after a click', () => {
    const { container } = render(
      <ColorModeProvider>
        <AppearanceModeToggle />
      </ColorModeProvider>,
    )
    const btn = container.querySelector('.awt-appearance-mode-toggle') as HTMLButtonElement
    const before = btn.getAttribute('aria-label')
    fireEvent.click(btn)
    const after = btn.getAttribute('aria-label')
    expect(before).not.toBeNull()
    expect(after).not.toBeNull()
    expect(after).not.toEqual(before)
  })
})
