/**
 * TopicList row-delete affordance: a deletable item (`onDelete` set) shows a right-justified trash
 * button that opens a confirmation; onDelete runs ONLY on confirm, never on cancel. Non-deletable
 * rows show no trash. Uses the REAL TopicDetail + AlertModal + Dialog (base-ui) — no dialog mocking.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { TopicDetail, type TopicDetailItem } from '../blocks/topic-detail'

// jsdom stubs for base-ui Dialog / floating-ui positioning (same shape as alertModal.test.tsx).
if (typeof Element !== 'undefined') {
  Element.prototype.getBoundingClientRect = vi.fn(
    (): DOMRect => ({
      width: 0,
      height: 0,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }),
  )
}
const _realGetComputedStyle = window.getComputedStyle.bind(window)
window.getComputedStyle = function patched(el: Element, pseudo?: string | null): CSSStyleDeclaration {
  const style = _realGetComputedStyle(el, pseudo)
  return new Proxy(style, {
    get(target, prop) {
      const val = Reflect.get(target, prop)
      if (typeof val === 'function') return val.bind(target)
      if (prop === 'transform') return (val as string) || 'none'
      return val
    },
  })
}

afterEach(() => vi.restoreAllMocks())

function renderList(onDelete: () => void | Promise<void>) {
  const items: TopicDetailItem[] = [
    { id: 'a', label: 'Alpha', onDelete },
    { id: 'b', label: 'Bravo' }, // not deletable — no onDelete
  ]
  return render(
    <TopicDetail items={items} selectedId={null} onSelect={() => {}}>
      <div>detail</div>
    </TopicDetail>,
  )
}

describe('TopicList row delete', () => {
  it('shows a trash button only for rows with onDelete', () => {
    renderList(vi.fn())
    expect(screen.getByRole('button', { name: 'Delete Alpha' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete Bravo' })).toBeNull()
  })

  it('always confirms — cancelling does NOT call onDelete', async () => {
    const onDelete = vi.fn()
    renderList(onDelete)
    fireEvent.click(screen.getByRole('button', { name: 'Delete Alpha' }))
    fireEvent.click(await screen.findByRole('button', { name: /^Cancel$/ }))
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('calls onDelete exactly once, only on confirm', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined)
    renderList(onDelete)
    fireEvent.click(screen.getByRole('button', { name: 'Delete Alpha' }))
    fireEvent.click(await screen.findByRole('button', { name: /^Delete$/ }))
    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1))
  })
})
