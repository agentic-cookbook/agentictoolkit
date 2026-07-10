import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ResizableSplit, revealRatioForContent } from '../components/resizable-split'

afterEach(() => {
  delete document.documentElement.dataset.reduceMotion
})

describe('ResizableSplit', () => {
  it('toggles bottom-pane collapse via the handle button', () => {
    const onCol = vi.fn()
    render(<ResizableSplit top={<div>TOP</div>} bottom={<div>BOTTOM</div>} collapsed={false} onCollapsedChange={onCol} bottomLabel="Details" />)
    fireEvent.click(screen.getByRole('button', { name: /Details/ }))
    expect(onCol).toHaveBeenCalledWith(true)
  })
  it('keeps the bottom pane MOUNTED but inert when collapsed (state survives hide/show)', () => {
    render(<ResizableSplit top={<div>TOP</div>} bottom={<div>BOTTOM</div>} collapsed />)
    const bottom = screen.getByText('BOTTOM')
    expect(bottom).toBeTruthy()
    expect((bottom.closest('[inert]') as HTMLElement | null)).not.toBeNull()
    expect(screen.getByText('TOP')).toBeTruthy()
  })
  it('exposes a separator with clamped aria-value', () => {
    render(<ResizableSplit top={<div>T</div>} bottom={<div>B</div>} defaultRatio={0.6} minRatio={0.2} maxRatio={0.85} />)
    const sep = screen.getByRole('separator')
    expect(Number(sep.getAttribute('aria-valuenow'))).toBeCloseTo(60, 0)
    fireEvent.keyDown(sep, { key: 'ArrowUp' })
    expect(Number(sep.getAttribute('aria-valuenow'))).toBeLessThan(60)
  })
  it('round-trips ratio via storageKey', () => {
    localStorage.setItem('split-test', '0.75')
    render(<ResizableSplit top={<div>T</div>} bottom={<div>B</div>} storageKey="split-test" minRatio={0.2} maxRatio={0.85} />)
    expect(Number(screen.getByRole('separator').getAttribute('aria-valuenow'))).toBeCloseTo(75, 0)
    localStorage.clear()
  })

  describe('header-bar variant', () => {
    it('renders the header content on the divider bar with the chevron far right', () => {
      render(<ResizableSplit top={<div>T</div>} bottom={<div>B</div>} header="Details" bottomLabel="Details" />)
      const sep = screen.getByRole('separator')
      expect(sep.textContent).toContain('Details')
      const chevron = screen.getByRole('button', { name: 'Details' })
      expect(sep.contains(chevron)).toBe(true)
      expect(chevron.getAttribute('aria-expanded')).toBe('true')
    })
    it('keeps the header bar visible while collapsed — it IS the collapsed remnant', () => {
      render(<ResizableSplit top={<div>T</div>} bottom={<div>B</div>} header="Details" collapsed />)
      expect(screen.getByRole('separator').textContent).toContain('Details')
      expect(screen.getByRole('button', { name: 'Details' }).getAttribute('aria-expanded')).toBe('false')
    })
    it('renders headerActions on the bar and lets them receive clicks', () => {
      const onAction = vi.fn()
      render(
        <ResizableSplit
          top={<div>T</div>}
          bottom={<div>B</div>}
          header="Details"
          headerActions={<button type="button" onClick={onAction}>copy</button>}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: 'copy' }))
      expect(onAction).toHaveBeenCalled()
    })
    it('still toggles on a chevron click AFTER a bar drag (stale moved flag)', () => {
      // jsdom has no pointer-capture; stub it so the drag handlers run.
      ;(Element.prototype as unknown as { setPointerCapture: () => void }).setPointerCapture = vi.fn()
      ;(Element.prototype as unknown as { releasePointerCapture: () => void }).releasePointerCapture = vi.fn()
      const onCol = vi.fn()
      render(
        <ResizableSplit top={<div>T</div>} bottom={<div>B</div>} header="Details" bottomLabel="Details" collapsed={false} onCollapsedChange={onCol} />,
      )
      const sep = screen.getByRole('separator')
      // Drag the bar (moves past the 3px threshold, ends elsewhere).
      fireEvent.pointerDown(sep, { clientY: 100, pointerId: 1 })
      fireEvent.pointerMove(sep, { clientY: 140, pointerId: 1 })
      fireEvent.pointerUp(sep, { clientY: 140, pointerId: 1 })
      // A subsequent plain chevron press+click must still toggle.
      const chevron = screen.getByRole('button', { name: 'Details' })
      fireEvent.pointerDown(chevron, { clientY: 140, pointerId: 2 })
      fireEvent.click(chevron)
      expect(onCol).toHaveBeenCalledWith(true)
    })

    it('expand-from-collapsed animates by default and skips animation under reduce-motion "on"', () => {
      document.documentElement.dataset.reduceMotion = 'on'
      const onCol = vi.fn()
      const { container } = render(
        <ResizableSplit top={<div>T</div>} bottom={<div>B</div>} header="Details" bottomLabel="Details" collapsed onCollapsedChange={onCol} />,
      )
      fireEvent.click(screen.getByRole('button', { name: 'Details' }))
      expect(onCol).toHaveBeenCalledWith(false)
      const topPane = container.firstElementChild!.firstElementChild as HTMLElement
      expect(topPane.style.transition).toBe('')
    })
  })
})

describe('revealRatioForContent', () => {
  it('opens exactly far enough to show all the content', () => {
    // 1000px container, 28px bar, 300px content → top gets 1 - 328/1000 = 0.672
    expect(revealRatioForContent(1000, 28, 300, 0.2, 0.85, 0.6)).toBeCloseTo(0.672)
  })
  it('clamps to minRatio when the content is taller than the container allows', () => {
    expect(revealRatioForContent(1000, 28, 2000, 0.2, 0.85, 0.6)).toBe(0.2)
  })
  it('clamps to maxRatio for tiny content', () => {
    expect(revealRatioForContent(1000, 28, 10, 0.2, 0.85, 0.6)).toBe(0.85)
  })
  it('falls back to the last ratio when the container or content is unmeasurable', () => {
    expect(revealRatioForContent(0, 28, 300, 0.2, 0.85, 0.55)).toBe(0.55)
    expect(revealRatioForContent(1000, 28, 0, 0.2, 0.85, 0.55)).toBe(0.55)
  })
})
