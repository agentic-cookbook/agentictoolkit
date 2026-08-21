'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'
import { Columns2, Eye, Pencil, Square } from 'lucide-react'

import {
  MarkdownEditor,
  type MarkdownEditorProps,
} from '@agentic-toolkit/ui/blocks/markdown-editor'
import { ToggleGroup, ToggleGroupItem } from '@agentic-toolkit/ui/components/toggle-group'
import { useMediaQuery } from '@agentic-toolkit/ui/hooks/useMediaQuery'
import { cn } from '@agentic-toolkit/ui/lib/utils'

import { MarkdownRenderer } from './MarkdownRenderer'
import { MarkdownReadingPalette } from './MarkdownReadingPalette'

/** Editor and preview stacked behind tabs, or set beside each other. */
export type MarkdownEditorLayout = 'tabbed' | 'split'
/** Which pane the tabbed layout is showing. */
export type MarkdownEditorTab = 'edit' | 'preview'

/**
 * Below this the split is not offered. Two half-width columns of prose on a phone are
 * unreadable, so the control is absent rather than present-and-disabled — an affordance you
 * can see but never use is worse than none.
 */
export const SPLIT_MIN_WIDTH = '(min-width: 64rem)'

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
  const wide = useMediaQuery(SPLIT_MIN_WIDTH)
  const [layout, setLayout] = useState<MarkdownEditorLayout>(defaultLayout)
  const [tab, setTab] = useState<MarkdownEditorTab>('edit')
  // Points the pane chooser at the pane container below, not at either pane: in tabbed mode
  // exactly one of the two panes is mounted, so an id on the unmounted one would be a dangling
  // `aria-controls` reference (ignored by AT) the instant the author switched tabs. The
  // container exists in both layouts and always resolves.
  const panesId = useId()

  // The PREFERENCE survives a narrow viewport even though the layout cannot be shown there:
  // only the EFFECTIVE layout collapses, so rotating back to landscape restores the split
  // instead of silently demoting the author's choice.
  const effective: MarkdownEditorLayout = wide ? layout : 'tabbed'
  const showEditor = effective === 'split' || tab === 'edit'
  const showPreview = effective === 'split' || tab === 'preview'

  const source = useDebounced(editor.value, PREVIEW_DEBOUNCE_MS)

  return (
    <div
      data-slot="markdown-document-editor"
      className="flex min-h-0 min-w-0 flex-1 flex-col gap-3"
    >
      {header}

      <div data-slot="markdown-editor-views" className="flex items-center gap-3">
        {wide && (
          <>
            <ToggleGroup
              aria-label="Editor layout"
              value={[layout]}
              onValueChange={(next: string[]) => {
                // Base UI hands back an array and an empty one means "the pressed item was
                // clicked again". A segmented control always keeps a selection, so ignore it.
                const picked = next[0]
                if (picked) setLayout(picked as MarkdownEditorLayout)
              }}
            >
              <ToggleGroupItem value="tabbed" aria-label="Single tabbed view" title="Single tabbed view">
                <Square />
              </ToggleGroupItem>
              <ToggleGroupItem value="split" aria-label="Side by side view" title="Side by side view">
                <Columns2 />
              </ToggleGroupItem>
            </ToggleGroup>
            {effective === 'tabbed' && <div aria-hidden className="h-5 w-px bg-apt-border" />}
          </>
        )}

        {/* In the split both panes are already visible, so a pane chooser would be a control
            with nothing to choose. */}
        {effective === 'tabbed' && (
          <ToggleGroup
            aria-label="Editor pane"
            value={[tab]}
            onValueChange={(next: string[]) => {
              const picked = next[0]
              if (picked) setTab(picked as MarkdownEditorTab)
            }}
          >
            <ToggleGroupItem value="edit" aria-controls={panesId}>
              <Pencil />
              Edit
            </ToggleGroupItem>
            <ToggleGroupItem value="preview" aria-controls={panesId}>
              <Eye />
              Preview
            </ToggleGroupItem>
          </ToggleGroup>
        )}
      </div>

      <div id={panesId} className="flex min-h-0 min-w-0 flex-1 gap-3">
        {showEditor && (
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
        {showPreview && (
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
