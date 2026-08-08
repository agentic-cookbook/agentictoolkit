/**
 * Unit tests for the drag-and-drop primitives.
 *
 * What these DO cover is the wiring: that a draggable hands its consumer the four things it
 * promises, that a grip is reachable by an accessible name, and that a zone's box is a real
 * element rather than `display: contents` (a zone with no rect can never be a drop target,
 * which is exactly the empty-column case the zone exists for).
 *
 * What they do NOT cover is the drop math, and that is a limit worth stating rather than
 * papering over: dnd-kit decides where a card landed by comparing measured RECTS, and jsdom
 * reports every rect as 0×0 at 0,0. A drag driven here would resolve every collision to
 * "nothing" no matter what the code under it said, so a passing assertion would be evidence
 * about jsdom, not about `landsAfter`. That behaviour belongs to the e2e suite, where the
 * boxes have sizes.
 */
/// <reference types="@testing-library/jest-dom/vitest" />
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import {
  DragGrip,
  DragItem,
  DragSurface,
  DropTarget,
  SortableItem,
  SortableSurface,
  SortableZone,
} from '../components/dnd'

describe('DragGrip', () => {
  it('names itself after what it reorders', () => {
    render(<DragGrip subject="work item Fix the login redirect" />)
    expect(
      screen.getByLabelText('Reorder work item Fix the login redirect'),
    ).toBeInTheDocument()
  })

  it('falls back to a bare name when it is handed no subject', () => {
    render(<DragGrip />)
    expect(screen.getByLabelText('Reorder')).toBeInTheDocument()
  })

  it('is a span, not a button — SortableItem may spread role="button" onto it', () => {
    render(<DragGrip subject="row" data-testid="grip" />)
    const grip = screen.getByTestId('grip')
    expect(grip.tagName).toBe('SPAN')
    // A nested role="button" would be invalid, which is the whole reason for the span.
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('keeps `touch-none`, without which a touch drag never starts', () => {
    render(<DragGrip subject="row" data-testid="grip" />)
    expect(screen.getByTestId('grip').className).toContain('touch-none')
  })
})

describe('SortableItem', () => {
  it('hands its consumer a ref, a style, handle props and a dragging flag', () => {
    // Assigned, not appended: the render prop runs more than once (a re-render on mount is
    // normal), and a growing array would assert about React's scheduling instead of the shape.
    let seen: string[] = []
    render(
      <SortableSurface zones={[{ id: 'z', itemIds: ['a'] }]} onDrop={vi.fn()}>
        <SortableZone id="z" itemIds={['a']}>
          {({ setNodeRef }) => (
            <div ref={setNodeRef}>
              <SortableItem id="a">
                {(drag) => {
                  seen = Object.keys(drag)
                  return (
                    <div ref={drag.setNodeRef} style={drag.style} data-dragging={drag.dragging}>
                      <DragGrip {...drag.handleProps} subject="row a" />
                    </div>
                  )
                }}
              </SortableItem>
            </div>
          )}
        </SortableZone>
      </SortableSurface>,
    )
    expect(seen).toEqual(['setNodeRef', 'style', 'handleProps', 'dragging'])
    // Idle, not mid-drag — the flag is what a row reads to dim itself.
    expect(screen.getByLabelText('Reorder row a').closest('[data-dragging]')).toHaveAttribute(
      'data-dragging',
      'false',
    )
  })

  it('installs the keyboard sensor by default — the grip becomes role="button"', () => {
    render(
      <SortableSurface zones={[{ id: 'z', itemIds: ['a'] }]} onDrop={vi.fn()}>
        <SortableZone id="z" itemIds={['a']}>
          {({ setNodeRef }) => (
            <div ref={setNodeRef}>
              <SortableItem id="a">
                {(drag) => <DragGrip {...drag.handleProps} subject="row a" />}
              </SortableItem>
            </div>
          )}
        </SortableZone>
      </SortableSurface>,
    )
    expect(screen.getByRole('button', { name: 'Reorder row a' })).toBeInTheDocument()
  })

  it('gives a disabled row no handle props at all', () => {
    // A filtered list, or a row with a write already in flight: there is nothing to grab, and
    // an inert listener map would leave the grab cursor lying about what a drag would do.
    render(
      <SortableSurface zones={[{ id: 'z', itemIds: ['a'] }]} onDrop={vi.fn()}>
        <SortableZone id="z" itemIds={['a']}>
          {({ setNodeRef }) => (
            <div ref={setNodeRef}>
              <SortableItem id="a" enabled={false}>
                {(drag) => (
                  <DragGrip {...drag.handleProps} subject="row a" data-testid="grip" />
                )}
              </SortableItem>
            </div>
          )}
        </SortableZone>
      </SortableSurface>,
    )
    expect(screen.getByTestId('grip')).not.toHaveAttribute('role')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('DragItem', () => {
  it('leaves the keyboard sensor OFF by default, so a chip inside a button stays one role', () => {
    render(
      <DragSurface onDrop={vi.fn()}>
        <DragItem id="chip">
          {(drag) => (
            <button type="button" ref={drag.setNodeRef} {...drag.handleProps}>
              Ship the release
            </button>
          )}
        </DragItem>
      </DragSurface>,
    )
    const chip = screen.getByRole('button', { name: 'Ship the release' })
    // dnd-kit's `attributes` would have added a SECOND role here; `keyboard` defaults to false
    // precisely so the element keeps the role it already had.
    expect(chip).not.toHaveAttribute('role')
    expect(chip.tagName).toBe('BUTTON')
  })
})

describe('DropTarget', () => {
  it('reports not-over while nothing is being dragged', () => {
    render(
      <DragSurface onDrop={vi.fn()}>
        <DropTarget id="day:20000">
          {({ setNodeRef, isOver }) => (
            <div ref={setNodeRef} data-testid="day" data-over={isOver} />
          )}
        </DropTarget>
      </DragSurface>,
    )
    expect(screen.getByTestId('day')).toHaveAttribute('data-over', 'false')
  })

  it('is never over when it is disabled', () => {
    render(
      <DragSurface onDrop={vi.fn()}>
        <DropTarget id="day:20000" enabled={false}>
          {({ setNodeRef, isOver }) => (
            <div ref={setNodeRef} data-testid="day" data-over={isOver} />
          )}
        </DropTarget>
      </DragSurface>,
    )
    expect(screen.getByTestId('day')).toHaveAttribute('data-over', 'false')
  })
})
