import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { Clip } from '../blocks/Clip'

/**
 * `matchMedia` is shimmed by the shared setup file to report "no match" for
 * everything, which is the motion-is-fine case. These tests swap in a stub that
 * answers the reduced-motion query so both branches are exercised.
 */
function stubReducedMotion(reduce: boolean): () => void {
  const original = window.matchMedia
  window.matchMedia = ((query: string) => ({
    matches: reduce && query === '(prefers-reduced-motion: reduce)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  return () => {
    window.matchMedia = original
  }
}

describe('Clip', () => {
  it('autoplays and loops when motion is fine', () => {
    const restore = stubReducedMotion(false)
    const { container } = render(<Clip src="/demo.mp4" label="A demo" />)
    const video = container.querySelector('video')!
    expect(video.autoplay).toBe(true)
    expect(video.loop).toBe(true)
    expect(video.controls).toBe(false)
    expect(video.getAttribute('aria-label')).toBe('A demo')
    restore()
  })

  it('does not autoplay, and offers controls, when reduced motion is preferred', () => {
    const restore = stubReducedMotion(true)
    const { container } = render(<Clip src="/demo.mp4" label="A demo" />)
    const video = container.querySelector('video')!
    expect(video.autoplay).toBe(false)
    expect(video.loop).toBe(false)
    expect(video.controls).toBe(true)
    restore()
  })

  // The attribute alone is not enough: the server always renders `autoplay`, so
  // a slow-JS load can start playback from the raw HTML before React re-renders,
  // and clearing the attribute afterwards does not stop a playing video. The
  // effect has to call pause().
  it('force-pauses the element rather than trusting the attribute', () => {
    const restore = stubReducedMotion(true)
    const pause = vi.fn()
    // jsdom implements no media playback: its own pause() only logs "Not
    // implemented", so the call has to be observed through a stub.
    const original = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'pause')!
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value: pause,
    })
    try {
      render(<Clip src="/demo.mp4" label="A demo" />)
      expect(pause).toHaveBeenCalled()
    } finally {
      Object.defineProperty(HTMLMediaElement.prototype, 'pause', original)
      restore()
    }
  })
})
