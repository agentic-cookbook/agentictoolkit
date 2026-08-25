'use client'

import { useEffect, useState, type ReactNode } from 'react'

import {
  MarkdownEditor,
  type MarkdownEditorProps,
} from '@agentic-toolkit/ui/blocks/markdown-editor'
import {
  SplitViewControl,
  useSplitView,
  SPLIT_VIEW_MIN_WIDTH,
  type SplitViewLayout,
  type SplitViewPane,
} from '@agentic-toolkit/ui/blocks/split-view-control'
import { cn } from '@agentic-toolkit/ui/lib/utils'

import { MarkdownRenderer } from './MarkdownRenderer'
import { MarkdownReadingPalette } from './MarkdownReadingPalette'

// The layout/pane vocabulary and the control that drives it now live in
// `@agentic-toolkit/ui/blocks/split-view-control`, because a second surface — the registry
// signup-form builder — needed the same control and had written its own copy. These three
// names stay exported under their old spellings: they are this package's public API, and
// nothing about a consumer changes just because the definition moved.

/** Editor and preview stacked behind tabs, or set beside each other. */
export type MarkdownEditorLayout = SplitViewLayout
/** Which pane the tabbed layout is showing. */
export type MarkdownEditorTab = SplitViewPane

/**
 * Below this the split is not offered. Two half-width columns of prose on a phone are
 * unreadable, so the control is absent rather than present-and-disabled — an affordance you
 * can see but never use is worse than none.
 */
export const SPLIT_MIN_WIDTH = SPLIT_VIEW_MIN_WIDTH

/** Quiet time before the preview re-renders. `MarkdownRenderer` re-runs the whole unified +
 *  shiki pipeline per content change; per-keystroke would be a pipeline per character. */
const PREVIEW_DEBOUNCE_MS = 300

function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return settled
}

export interface MarkdownDocumentEditorProps extends MarkdownEditorProps {
  /** The document's identity fields, rendered above the control strip and outside both
   *  panes — they belong to the document, not to one view of its body. */
  header?: ReactNode
  /** Layout to open in on a wide viewport. Narrow always opens tabbed. */
  defaultLayout?: MarkdownEditorLayout
  /** Rendered inside the editor pane's positioning context — a typeahead listbox, a drag
   *  target, anything that must sit against the textarea rather than the page. Absent from
   *  the preview pane by construction: it belongs to editing. */
  overlay?: ReactNode
  /** Extra classes for the preview pane. A host that is not `fill` uses it to give the
   *  preview the same bulk as its textarea, so switching panes doesn't resize the page. */
  previewClassName?: string
  /** Reading theme for the preview pane, forwarded to `MarkdownReadingPalette`. Defaults to
   *  that component's own default (`DEFAULT_THEME_ID`). */
  themeId?: string
}

/**
 * The shared document editing view: the body editor, a live preview rendered by the SAME
 * pipeline and reading palette the published page uses, and a control strip for choosing
 * between them.
 *
 * Consumers must import `@agentic-toolkit/markdown/styles` once at their seam — this package
 * follows the repo's seam-owns-its-CSS convention (see the research site's PaperRenderer),
 * so the stylesheet is never pulled in by a component. Every ADH family site already has it
 * via adh-family.css -> adh-help.css; that same sheet is what registers this file's Tailwind
 * utilities, through the `@source` globs over `src/components` and `dist`.
 *
 * Everything else is `MarkdownEditor`'s: `value`, `onChange`, `label`, `onUpload`,
 * `toolbarExtras`, `className`, … are forwarded untouched onto the editor pane (merged with
 * this component's own required layout classes, never replacing them), so this is a drop-in
 * replacement at any existing call site. `fill` defaults to `true` here — unlike
 * `MarkdownEditor` itself, whose default is `false` — because both this component's layouts
 * are meant to fill their container by construction; pass `fill={false}` to opt back into a
 * fixed-`rows` box.
 */
export function MarkdownDocumentEditor({
  header,
  defaultLayout = 'tabbed',
  overlay,
  previewClassName,
  fill = true,
  themeId,
  ...editor
}: MarkdownDocumentEditorProps): React.JSX.Element {
  const view = useSplitView({ defaultLayout })

  const source = useDebounced(editor.value, PREVIEW_DEBOUNCE_MS)

  return (
    // NO `min-h-0` here, deliberately. `min-h-0` waives a flex item's automatic (content-based)
    // minimum, and this editor's whole chain used to carry it: given a pane shorter than the
    // editor needs, every box from the card down shrank to whatever was left — the panes row
    // measured ZERO height at 768x723 — and because they are all `overflow: visible`, the fields
    // did not clip or scroll, they PAINTED ON TOP OF ONE ANOTHER (title, slug, categories, tags,
    // the layout toggles and the body toolbar all inside one ~100px band). Keeping the automatic
    // minimum is what turns "too short" into an overflow the pane's scroller can deal with,
    // instead of a collapse nothing can. It costs nothing when there IS room: `flex-1` still
    // grows this to fill a tall pane — a minimum only ever refuses to shrink.
    <div
      data-slot="markdown-document-editor"
      className="flex min-w-0 flex-1 flex-col gap-3"
    >
      {header}

      <SplitViewControl view={view} subject="Editor" />

      {/* The body's FLOOR. `fill` hands this row the pane's leftover height, and leftover height
          can be nothing at all — so a floor is what keeps a filling editor from filling with
          zero. 14rem leaves the textarea ~10rem once the label and the toolbar above it have
          taken theirs, which is a body you can actually write in rather than a slot. Above the
          floor nothing changes: `flex-1` still takes every spare pixel of a tall pane. Only the
          `fill` layout needs it — a `fill={false}` host sizes the textarea by `rows` and has no
          leftover height to run out of (notebook's NoteFields). */}
      <div id={view.panesId} className={cn('flex min-h-0 min-w-0 flex-1 gap-3', fill && 'min-h-56')}>
        {view.showEditor && (
          // The wrapper is unconditional: `relative` with no overlay costs nothing, and a
          // wrapper that appears only when an overlay does would change the pane's box the
          // moment a mention listbox opened.
          <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
            <MarkdownEditor
              {...editor}
              fill={fill}
              className={cn('min-h-0 min-w-0 flex-1', editor.className)}
            />
            {overlay}
          </div>
        )}
        {view.showPreview && (
          <MarkdownReadingPalette
            themeId={themeId}
            data-slot="markdown-preview"
            className={cn(
              'min-h-0 min-w-0 flex-1 rounded-md border border-apt-border',
              previewClassName,
            )}
          >
            {/* The document itself is not a live region: every debounce tick would otherwise
                re-announce the whole rendered document to screen readers 300ms after the
                author stops typing. */}
            <div aria-live="off">
              {source.trim() ? (
                <MarkdownRenderer content={source} />
              ) : (
                <p className="text-sm text-apt-text-dim">Nothing to preview yet.</p>
              )}
            </div>
          </MarkdownReadingPalette>
        )}
      </div>
    </div>
  )
}
