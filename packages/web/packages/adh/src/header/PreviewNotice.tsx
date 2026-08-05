'use client'

import { useEffect, useId, useRef, useState, type ReactElement } from 'react'
import { ChevronDown, TriangleAlert } from 'lucide-react'

/** The whole family is a pre-launch preview, and every header says so in the strip
 *  above the bar. A DEFAULT, not a fixture — `previewNotice` overrides it, so the words
 *  are reachable from the host rather than sealed into this package.
 *
 *  The default earns its place under the same carve-out the package's default
 *  accessible names get: 46 sites all saying the same sentence should not each restate
 *  it, and a header that rendered nothing until every host was updated would ship 46
 *  sites with no notice at all. What must not happen is the words being UNREACHABLE
 *  from the host — the package owns the UI, the host owns the words.
 *
 *  This replaced a `Preview Release` BADGE under the site name. A badge sat inside
 *  the bar's lead slot, so it competed with the brand for the one part of the header
 *  that has to survive a 390px phone; a full-width strip above the bar costs the bar
 *  no horizontal room at all, and reads as a property of the site rather than of its
 *  name. */
export const DEFAULT_PREVIEW_NOTICE = 'Developer Preview Release'

/** What the strip says when you ask it what "preview" means — the panel behind the
 *  caret. Same host-owns-the-words carve-out as {@link DEFAULT_PREVIEW_NOTICE}, and a
 *  default for the same reason: the sentence is true of the whole family, so 46 hosts
 *  should not each restate it. */
export const DEFAULT_PREVIEW_DETAIL =
  'We are in very early stages, and are only taking requests to join.'

export type PreviewNoticeProps = {
  /** The strip's headline words. */
  notice?: string
  /** The sentence the caret reveals. */
  detail?: string
}

/**
 * The family-wide preview strip: a caution-flanked headline that doubles as a
 * disclosure trigger for a one-sentence panel explaining what "preview" means here.
 *
 * Its own module rather than markup inside {@link AdhHeader} because it now holds
 * state and three dismissal paths; the header composes it as a leaf.
 */
export function PreviewNotice({
  notice = DEFAULT_PREVIEW_NOTICE,
  detail = DEFAULT_PREVIEW_DETAIL,
}: PreviewNoticeProps): ReactElement {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    // "A click anywhere dismisses it" — the panel's own text included — so this is a
    // blanket document listener, not an outside-click test.
    //
    // The TRIGGER is the one exception, and it has to be: this listener is capture-phase
    // on `document`, so it runs BEFORE React's own handler (delegated at the app root).
    // Closing here on a trigger click would land first and the button's toggle would
    // immediately re-open — leaving the one control that opened the panel unable to
    // close it. It owns its own toggle instead.
    //
    // Attached only while open, which is also what keeps the OPENING click harmless: by
    // the time this effect runs that click has finished propagating.
    const onClick = (e: MouseEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('click', onClick, true)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open])

  return (
    <div className="adh-header__preview">
      {/* Trigger and panel share one box so a single `mouseleave` covers both. The panel
          is absolutely positioned and so contributes nothing to this element's layout
          box — but `mouseleave` is defined over the DOM TREE, not the box, so moving the
          pointer down onto the panel is still "inside" and does not dismiss what the
          user is moving toward. Only leaving the pair does. */}
      <span className="adh-header__preview-disclosure" onMouseLeave={() => setOpen(false)}>
        <button
          ref={triggerRef}
          type="button"
          className="adh-header__preview-trigger"
          aria-expanded={open}
          // Only while the panel exists: this renders conditionally, and a dangling
          // `aria-controls` points a screen reader at nothing.
          aria-controls={open ? panelId : undefined}
          onClick={() => setOpen((v) => !v)}
        >
          {/* Decorative: the caution is what the words already say, so announcing it
              twice buys a screen-reader user nothing. The button's accessible name is
              therefore the notice itself. */}
          <TriangleAlert className="adh-header__preview-icon" aria-hidden />
          <span className="adh-header__preview-text">{notice}</span>
          <TriangleAlert className="adh-header__preview-icon" aria-hidden />
          <ChevronDown className="adh-header__preview-caret" aria-hidden />
        </button>
        {open && (
          <span className="adh-header__preview-panel" id={panelId}>
            {detail}
          </span>
        )}
      </span>
    </div>
  )
}
