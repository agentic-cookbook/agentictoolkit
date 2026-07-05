import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ResizableSplit } from '../components/resizable-split'

describe('ResizableSplit', () => {
  it('toggles bottom-pane collapse via the handle button', () => {
    const onCol = vi.fn()
    render(<ResizableSplit top={<div>TOP</div>} bottom={<div>BOTTOM</div>} collapsed={false} onCollapsedChange={onCol} bottomLabel="Details" />)
    fireEvent.click(screen.getByRole('button', { name: /Details/ }))
    expect(onCol).toHaveBeenCalledWith(true)
  })
  it('hides the bottom pane content when collapsed', () => {
    render(<ResizableSplit top={<div>TOP</div>} bottom={<div>BOTTOM</div>} collapsed />)
    expect(screen.queryByText('BOTTOM')).toBeNull()
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
})
