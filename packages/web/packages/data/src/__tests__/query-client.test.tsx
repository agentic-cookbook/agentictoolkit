/// <reference types="@testing-library/jest-dom/vitest" />
import { render, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ToolkitQueryProvider,
  getToolkitQueryClient,
  useToolkitQueryClient,
} from '../query'

// Unstub FIRST: `cleanup()` touches the DOM, and the server-render test below leaves `window`
// stubbed to undefined.
afterEach(() => {
  vi.unstubAllGlobals()
  cleanup()
})

const seen: unknown[] = []
function Probe() {
  seen.push(useToolkitQueryClient())
  return <div data-testid="probe" />
}

describe('the toolkit query client', () => {
  it('is ONE instance in the browser', () => {
    expect(getToolkitQueryClient()).toBe(getToolkitQueryClient())
  })

  // The whole defect: the App Router remounts the page subtree on a same-segment param
  // navigation, so the provider is destroyed and rebuilt on every topic click. A client held in
  // component state dies with it, and the cache is empty every single time.
  it('survives a provider that is unmounted and mounted again', () => {
    seen.length = 0
    const { unmount } = render(
      <ToolkitQueryProvider>
        <Probe />
      </ToolkitQueryProvider>,
    )
    unmount()
    render(
      <ToolkitQueryProvider>
        <Probe />
      </ToolkitQueryProvider>,
    )
    expect(seen).toHaveLength(2)
    expect(seen[0]).toBe(seen[1])
  })

  // 39 useResourceList call sites, and nothing guarantees a provider above any of them. Reading
  // the client from context alone would turn a missing provider into a runtime throw.
  it('hands a consumer the same client with NO provider above it', () => {
    seen.length = 0
    render(<Probe />)
    expect(seen[0]).toBe(getToolkitQueryClient())
  })

  it('makes a FRESH client per call on the server', () => {
    vi.stubGlobal('window', undefined)
    expect(getToolkitQueryClient()).not.toBe(getToolkitQueryClient())
  })
})
