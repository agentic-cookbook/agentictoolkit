import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { createRef, createElement } from 'react'
import type { CSSProperties } from 'react'
import { useContentHuggingSize } from '../hooks/useContentHuggingSize'
import type { InlineChatSizing } from '../modes/InlineChat'

// jsdom doesn't lay anything out, so getBoundingClientRect returns zeros.
// Stub the prototype so the hook's chatBottom / anchorBottom math is meaningful.
const ORIGINAL_GBCR = Element.prototype.getBoundingClientRect
const rectsByElement = new WeakMap<Element, DOMRect>()

function setRect(el: Element, rect: Partial<DOMRect>) {
  rectsByElement.set(el, {
    x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0,
    toJSON: () => ({}),
    ...rect,
  } as DOMRect)
}

beforeEach(() => {
  Element.prototype.getBoundingClientRect = function () {
    return rectsByElement.get(this) ?? { x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}) } as DOMRect
  }
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
})

afterEach(() => {
  Element.prototype.getBoundingClientRect = ORIGINAL_GBCR
})

interface ProbeApi {
  style: CSSProperties
  el: HTMLDivElement | null
}

/**
 * Renders a component using the hook with a controlled chat-element rect.
 * Returns the latest rendered style (after the layoutEffect fires) and the
 * resolved ref element. Tests assert against `api.style.maxHeight`.
 */
function renderProbe(sizing: InlineChatSizing | undefined, chatRect: Partial<DOMRect>): ProbeApi {
  const api: ProbeApi = { style: {}, el: null }

  function Probe() {
    const { ref, style } = useContentHuggingSize(sizing)
    api.style = style
    return createElement('div', {
      ref: (el: HTMLDivElement | null) => {
        ref.current = el
        api.el = el
        if (el) setRect(el, chatRect)
      },
    })
  }

  render(createElement(Probe))
  return api
}

describe('useContentHuggingSize', () => {
  it('returns empty style when sizing is undefined', () => {
    const api = renderProbe(undefined, { bottom: 700 })
    expect(api.style).toEqual({})
  })

  it('returns empty style when sizing.mode is fixed', () => {
    const api = renderProbe({ mode: 'fixed' }, { bottom: 700 })
    expect(api.style).toEqual({})
    expect(api.el?.classList.contains('pc-hugging')).toBe(false)
  })

  it('resolves css length: px', () => {
    const api = renderProbe(
      { mode: 'content-hugging', maxHeight: { kind: 'css', value: '400px' } },
      { bottom: 700 },
    )
    expect(api.style.maxHeight).toBe('400px')
  })

  it('resolves css length: vh', () => {
    const api = renderProbe(
      { mode: 'content-hugging', maxHeight: { kind: 'css', value: '60vh' } },
      { bottom: 700 },
    )
    // 60% of innerHeight=800 = 480
    expect(api.style.maxHeight).toBe('480px')
  })

  it('resolves viewport-offset: chatBottom - topOffsetPx', () => {
    const api = renderProbe(
      { mode: 'content-hugging', maxHeight: { kind: 'viewport-offset', topOffsetPx: 80 } },
      { bottom: 780 },
    )
    expect(api.style.maxHeight).toBe('700px')
  })

  it('resolves element-offset: chatBottom - (anchorBottom + gapPx)', () => {
    const anchor = document.createElement('div')
    document.body.appendChild(anchor)
    setRect(anchor, { bottom: 120 })
    const ref = createRef<HTMLElement>()
    // @ts-expect-error – test-only direct ref assignment
    ref.current = anchor

    const api = renderProbe(
      { mode: 'content-hugging', maxHeight: { kind: 'element-offset', ref, gapPx: 40 } },
      { bottom: 780 },
    )
    // 780 - (120 + 40) = 620
    expect(api.style.maxHeight).toBe('620px')
  })

  it('element-offset: gapPx defaults to 0', () => {
    const anchor = document.createElement('div')
    document.body.appendChild(anchor)
    setRect(anchor, { bottom: 100 })
    const ref = createRef<HTMLElement>()
    // @ts-expect-error – test-only direct ref assignment
    ref.current = anchor

    const api = renderProbe(
      { mode: 'content-hugging', maxHeight: { kind: 'element-offset', ref } },
      { bottom: 780 },
    )
    expect(api.style.maxHeight).toBe('680px')
  })

  it('element-offset: null anchor falls back to chatBottom', () => {
    const ref = createRef<HTMLElement>() // .current stays null
    const api = renderProbe(
      { mode: 'content-hugging', maxHeight: { kind: 'element-offset', ref, gapPx: 0 } },
      { bottom: 500 },
    )
    expect(api.style.maxHeight).toBe('500px')
  })

  it('clamps negative results to 0', () => {
    const api = renderProbe(
      { mode: 'content-hugging', maxHeight: { kind: 'viewport-offset', topOffsetPx: 1000 } },
      { bottom: 200 },
    )
    // 200 - 1000 = -800 → clamped to 0
    expect(api.style.maxHeight).toBe('0px')
  })

  it('adds and removes the hugging class on the chat element and its parent', () => {
    const api: ProbeApi = { style: {}, el: null }
    const refs: { parent: HTMLDivElement | null; chat: HTMLDivElement | null } = {
      parent: null,
      chat: null,
    }

    function Probe() {
      const { ref, style } = useContentHuggingSize({
        mode: 'content-hugging',
        maxHeight: { kind: 'css', value: '300px' },
      })
      api.style = style
      return createElement(
        'div',
        {
          className: 'pc-inline',
          ref: (el: HTMLDivElement | null) => { if (el) refs.parent = el },
        },
        createElement('div', {
          ref: (el: HTMLDivElement | null) => {
            ref.current = el
            api.el = el
            if (el) {
              refs.chat = el
              setRect(el, { bottom: 700 })
            }
          },
        }),
      )
    }

    const { unmount } = render(createElement(Probe))
    expect(refs.chat?.classList.contains('pc-hugging')).toBe(true)
    expect(refs.parent?.classList.contains('pc-hugging')).toBe(true)

    unmount()
    expect(refs.parent?.classList.contains('pc-hugging')).toBe(false)
  })

  it('recomputes on window resize', () => {
    const api = renderProbe(
      { mode: 'content-hugging', maxHeight: { kind: 'css', value: '50vh' } },
      { bottom: 700 },
    )
    expect(api.style.maxHeight).toBe('400px') // 50% of 800

    act(() => {
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 })
      window.dispatchEvent(new Event('resize'))
    })
    expect(api.style.maxHeight).toBe('500px') // 50% of 1000
  })
})
