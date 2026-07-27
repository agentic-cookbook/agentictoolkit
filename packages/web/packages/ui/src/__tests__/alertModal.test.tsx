/**
 * Unit tests for AlertModal — covers alert mode, confirm mode, busy mode,
 * destructive variant, tone title display, and closed state.
 *
 * Uses the REAL AlertModal + Dialog (base-ui). No Dialog mocking.
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { AlertModal } from '../components/alert-modal'
import { DialogActions } from '../components/dialog-actions'

// ---------------------------------------------------------------------------
// jsdom stubs for floating-ui / base-ui popup positioning
// base-ui Dialog uses floating-ui which reads getBoundingClientRect and
// getComputedStyle. Patch once at module level so the stubs survive all tests.
// ---------------------------------------------------------------------------
if (typeof Element !== 'undefined') {
  // Zero-size rect is enough for floating-ui to not throw.
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

// Capture the real getComputedStyle before any spy touches it.
const _realGetComputedStyle = window.getComputedStyle.bind(window)

// Replace directly (not via vi.spyOn, which wraps recursively on re-entry).
window.getComputedStyle = function patchedGetComputedStyle(
  el: Element,
  pseudo?: string | null,
): CSSStyleDeclaration {
  const style = _realGetComputedStyle(el, pseudo)
  // floating-ui reads 'transform' to detect positioned ancestors.
  return new Proxy(style, {
    get(target, prop) {
      const val = Reflect.get(target, prop)
      if (typeof val === 'function') return val.bind(target)
      if (prop === 'transform') return (val as string) || 'none'
      return val
    },
  })
}

afterEach(() => {
  vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Alert mode (no cancelLabel)
// ---------------------------------------------------------------------------
describe('AlertModal — alert mode', () => {
  it('renders exactly one action button with confirmLabel', () => {
    const onConfirm = vi.fn()
    render(
      <AlertModal
        open={true}
        title="Heads up"
        confirmLabel="Got it"
        onConfirm={onConfirm}
      />,
    )

    const confirmBtn = screen.getByRole('button', { name: 'Got it' })
    expect(confirmBtn).toBeTruthy()

    // Should NOT have a cancel button.
    expect(screen.queryByRole('button', { name: /cancel/i })).toBeNull()
  })

  it('calls onConfirm when the confirm button is clicked', () => {
    const onConfirm = vi.fn()
    render(
      <AlertModal
        open={true}
        title="Heads up"
        confirmLabel="Got it"
        onConfirm={onConfirm}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })
})

// ---------------------------------------------------------------------------
// Confirm mode (cancelLabel set)
// ---------------------------------------------------------------------------
describe('AlertModal — confirm mode', () => {
  it('renders two action buttons when cancelLabel is provided', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <AlertModal
        open={true}
        title="Are you sure?"
        confirmLabel="Yes"
        cancelLabel="No"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )

    expect(screen.getByRole('button', { name: 'Yes' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'No' })).toBeTruthy()
  })

  it('calls onConfirm when the confirm button is clicked', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <AlertModal
        open={true}
        title="Are you sure?"
        confirmLabel="Yes"
        cancelLabel="No"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Yes' }))
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('calls onCancel when the cancel button is clicked', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <AlertModal
        open={true}
        title="Are you sure?"
        confirmLabel="Yes"
        cancelLabel="No"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'No' }))
    expect(onCancel).toHaveBeenCalledOnce()
    expect(onConfirm).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Busy mode
// ---------------------------------------------------------------------------
describe('AlertModal — busy mode', () => {
  it('renders NO action buttons when busy=true', () => {
    const onConfirm = vi.fn()
    render(
      <AlertModal
        open={true}
        title="Working…"
        confirmLabel="OK"
        onConfirm={onConfirm}
        busy={true}
      />,
    )

    expect(screen.queryByRole('button', { name: /^ok$/i })).toBeNull()
  })

  it('hides the close ✕ button when busy=true', () => {
    const onConfirm = vi.fn()
    render(
      <AlertModal
        open={true}
        title="Please wait"
        confirmLabel="OK"
        onConfirm={onConfirm}
        busy={true}
      />,
    )

    // showClose=false removes the aria-label="Close" button from DialogContent.
    expect(screen.queryByRole('button', { name: /^close$/i })).toBeNull()
  })

  it('shows a spinner (aria-label "Working…") when busy=true', () => {
    const onConfirm = vi.fn()
    render(
      <AlertModal
        open={true}
        title="Please wait"
        confirmLabel="OK"
        onConfirm={onConfirm}
        busy={true}
      />,
    )

    // The Loader2 SVG gets aria-label="Working…" and role="status"
    expect(screen.getByLabelText('Working…')).toBeTruthy()
    expect(screen.getByRole('status')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// confirmVariant="destructive"
// ---------------------------------------------------------------------------
describe('AlertModal — confirmVariant', () => {
  it('applies the destructive class to the confirm button when confirmVariant="destructive"', () => {
    const onConfirm = vi.fn()
    render(
      <AlertModal
        open={true}
        title="Delete item"
        confirmLabel="Delete"
        confirmVariant="destructive"
        cancelLabel="Cancel"
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />,
    )

    const deleteBtn = screen.getByRole('button', { name: 'Delete' })
    // buttonVariants CVA applies 'text-destructive' (and 'bg-destructive/10')
    // for the destructive variant — assert the class string contains it.
    expect(deleteBtn.className).toContain('destructive')
  })
})

// ---------------------------------------------------------------------------
// Tone — title is visible
// ---------------------------------------------------------------------------
describe('AlertModal — tone', () => {
  it('displays the title text for the danger tone', () => {
    render(
      <AlertModal
        open={true}
        title="Something went wrong"
        tone="error"
        onConfirm={vi.fn()}
      />,
    )

    expect(screen.getByText('Something went wrong')).toBeTruthy()
  })

  it('displays description when provided', () => {
    render(
      <AlertModal
        open={true}
        title="Confirm action"
        description="This cannot be undone."
        onConfirm={vi.fn()}
      />,
    )

    expect(screen.getByText('This cannot be undone.')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// open=false — nothing visible
// ---------------------------------------------------------------------------
describe('AlertModal — closed state', () => {
  it('renders nothing visible when open=false', () => {
    render(
      <AlertModal
        open={false}
        title="Hidden modal"
        confirmLabel="OK"
        onConfirm={vi.fn()}
      />,
    )

    // With base-ui Dialog, when open=false the portal content is not mounted.
    expect(screen.queryByText('Hidden modal')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Standardized behavior — keyboard policy, destructive mode, layout
// ---------------------------------------------------------------------------
describe('AlertModal — standardized behavior', () => {
  it('Enter triggers confirm under default keyboard', () => {
    const onConfirm = vi.fn()
    render(<AlertModal open title="Save?" cancelLabel="Cancel" onCancel={vi.fn()} onConfirm={onConfirm} />)
    fireEvent.keyDown(document.body, { key: 'Enter' })
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('keyboard "none" ignores Enter', () => {
    const onConfirm = vi.fn()
    render(<AlertModal open title="Save?" cancelLabel="Cancel" onCancel={vi.fn()} onConfirm={onConfirm} keyboard="none" />)
    fireEvent.keyDown(document.body, { key: 'Enter' })
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('destructive renders a red action and ignores Enter', () => {
    const onConfirm = vi.fn()
    render(<AlertModal open title="Delete?" confirmLabel="Delete" cancelLabel="Cancel" onCancel={vi.fn()} onConfirm={onConfirm} destructive />)
    const del = screen.getByRole('button', { name: 'Delete' })
    expect(del.className).toContain('bg-destructive')
    fireEvent.keyDown(document.body, { key: 'Enter' })
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('single-button alert uses a full-width action', () => {
    render(<AlertModal open title="Done" onConfirm={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'OK' }).className).toContain('w-full')
  })
})

// ---------------------------------------------------------------------------
// Escape key — contract coverage
//
// Base-UI registers a document keydown listener for Escape and calls
// onOpenChange(false, { reason: "escape-key" }) — this fires in jsdom because
// fireEvent dispatches a real DOM event that bubbles to document. The window
// keydown listener in AlertModal does NOT handle Escape (only Enter), so there
// is no double-fire path.
// ---------------------------------------------------------------------------
describe('AlertModal — Escape key contract', () => {
  it('default + confirm: Escape calls onCancel exactly once, not onConfirm', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <AlertModal
        open
        title="Are you sure?"
        confirmLabel="Yes"
        cancelLabel="No"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    )
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('default + alert (no cancelLabel): Escape calls onConfirm exactly once', () => {
    const onConfirm = vi.fn()
    render(
      <AlertModal
        open
        title="Heads up"
        confirmLabel="OK"
        onConfirm={onConfirm}
      />,
    )
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('keyboard="none": Escape calls neither onConfirm nor onCancel', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <AlertModal
        open
        title="Save?"
        confirmLabel="Save"
        cancelLabel="Cancel"
        onConfirm={onConfirm}
        onCancel={onCancel}
        keyboard="none"
      />,
    )
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('destructive: Escape does NOT call onConfirm (the delete must not fire)', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    render(
      <AlertModal
        open
        title="Delete item?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={onConfirm}
        onCancel={onCancel}
        destructive
      />,
    )
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// DialogActions — the equal-vs-natural rule lives in CSS, not in a measurement
// ---------------------------------------------------------------------------
describe('DialogActions — layout', () => {
  function renderActions(layout?: 'auto' | 'equal' | 'natural', cancelLabel: string | undefined = 'Cancel') {
    render(
      <DialogActions
        confirmLabel="OK"
        onConfirm={vi.fn()}
        cancelLabel={cancelLabel}
        onCancel={vi.fn()}
        {...(layout ? { layout } : {})}
      />,
    )
    return {
      row: document.querySelector('[data-slot="dialog-actions"]') as HTMLElement,
      confirm: screen.getByRole('button', { name: 'OK' }),
      cancel: cancelLabel != null ? screen.getByRole('button', { name: cancelLabel }) : null,
    }
  }

  // `flex-1 max-w-max` in a `justify-end` row IS the rule: grow into your share of
  // the row, stop at your natural width, and let the leftover collect on the left.
  // Wide row → natural widths, right-justified. Narrow row → an even split.
  it('defaults to "auto": each button grows but is capped at its natural width', () => {
    const { row, cancel, confirm } = renderActions()
    expect(row.className).toContain('justify-end')
    for (const btn of [cancel!, confirm]) {
      expect(btn.className).toContain('flex-1')
      expect(btn.className).toContain('max-w-max')
    }
  })

  it('"equal" splits the row evenly — growth is uncapped', () => {
    const { row, cancel, confirm } = renderActions('equal')
    expect(row.className).not.toContain('justify-end')
    for (const btn of [cancel!, confirm]) {
      expect(btn.className).toContain('flex-1')
      expect(btn.className).not.toContain('max-w-max')
    }
  })

  it('"natural" right-justifies and grows neither button', () => {
    const { row, cancel, confirm } = renderActions('natural')
    expect(row.className).toContain('justify-end')
    for (const btn of [cancel!, confirm]) expect(btn.className).not.toContain('flex-1')
  })

  // The regression this replaced: the row used to render "equal", measure the
  // buttons in a layout effect, then flip. The flip landed after the dialog was
  // already visible and clickable, and `Button`'s `transition-all` stretched it into
  // a ~150ms slide — so a click aimed at where Cancel had settled missed it. Nothing
  // may reposition the row after the first render.
  it('settles on the first render — mounting effects move nothing', () => {
    const { row, cancel } = renderActions()
    const rowClass = row.className
    const cancelClass = cancel!.className
    // A resize is the other path that used to re-measure; it must be inert now.
    window.dispatchEvent(new Event('resize'))
    expect(row.className).toBe(rowClass)
    expect(cancel!.className).toBe(cancelClass)
  })

  it('a lone confirm button is right-justified at its natural width', () => {
    const { row, confirm } = renderActions(undefined, undefined)
    expect(row.className).toContain('justify-end')
    expect(confirm.className).toContain('max-w-max')
  })
})

// ---------------------------------------------------------------------------
// AlertModal — busy spinner role="status"
// ---------------------------------------------------------------------------
describe('AlertModal — busy spinner', () => {
  it('renders a spinner with role="status" when busy=true', () => {
    render(<AlertModal open title="Please wait" confirmLabel="OK" onConfirm={vi.fn()} busy={true} />)
    const spinner = screen.getByRole('status')
    expect(spinner).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// AlertModal — showIcon prop (A-7)
// ---------------------------------------------------------------------------
describe('AlertModal — showIcon prop', () => {
  it('renders a tone icon by default (showIcon omitted)', () => {
    render(
      <AlertModal
        open={true}
        title="Heads up"
        tone="info"
        onConfirm={vi.fn()}
      />,
    )
    // The icon renders as an <svg aria-hidden> sibling of the title text.
    // Query via the container: the svg should be present inside the dialog.
    const dialog = screen.getByRole('dialog')
    const svgs = dialog.querySelectorAll('svg[aria-hidden]')
    expect(svgs.length).toBeGreaterThan(0)
  })

  it('hides the tone icon when showIcon={false}', () => {
    render(
      <AlertModal
        open={true}
        title="No icon here"
        tone="info"
        onConfirm={vi.fn()}
        showIcon={false}
      />,
    )
    // With showIcon={false} the icon SVG must not appear in the title area.
    // The title text still renders normally.
    const dialog = screen.getByRole('dialog')
    expect(screen.getByText('No icon here')).toBeTruthy()
    // aria-hidden svgs from the icon should be absent.
    // (The close ✕ button may render its own svg without aria-hidden=true on the
    // icon element — the TONES icon always has aria-hidden, so the count must
    // be 0 for tone-icon svg[aria-hidden] inside the title heading.)
    const titleEl = dialog.querySelector('[data-slot="dialog-title"]') ?? dialog.querySelector('h2') ?? dialog
    const svgs = titleEl.querySelectorAll('svg[aria-hidden]')
    expect(svgs.length).toBe(0)
  })
})
