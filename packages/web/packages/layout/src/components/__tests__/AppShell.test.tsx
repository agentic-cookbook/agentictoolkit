import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { AppShell } from '../AppShell'

describe('AppShell', () => {
  it('renders header, sidebar, main, toc slots', () => {
    const { container } = render(
      <AppShell
        header={<div data-test="h">H</div>}
        sidebar={<div data-test="s">S</div>}
        toc={<div data-test="t">T</div>}
      >
        <div data-test="m">M</div>
      </AppShell>,
    )
    expect(container.querySelector('[data-test="h"]')).not.toBeNull()
    expect(container.querySelector('[data-test="s"]')).not.toBeNull()
    expect(container.querySelector('[data-test="t"]')).not.toBeNull()
    expect(container.querySelector('[data-test="m"]')).not.toBeNull()
  })

  it('omits sidebar/toc when not provided', () => {
    const { container } = render(<AppShell header={<header />}><main /></AppShell>)
    expect(container.querySelector('.awt-app-shell__sidebar')).toBeNull()
    expect(container.querySelector('.awt-app-shell__toc')).toBeNull()
  })
})
