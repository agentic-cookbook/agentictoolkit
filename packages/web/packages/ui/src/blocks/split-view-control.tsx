"use client"

import { useId, useState } from "react"
import { Columns2, Eye, Pencil, Square } from "lucide-react"

import { ToggleGroup, ToggleGroupItem } from "../components/toggle-group"
import { useMediaQuery } from "../hooks/useMediaQuery"
import { cn } from "../lib/utils"

/** Edit and preview stacked behind tabs, or set beside each other. */
export type SplitViewLayout = "tabbed" | "split"
/** Which pane the tabbed layout is showing. */
export type SplitViewPane = "edit" | "preview"

/**
 * Below this the split is not offered. Two half-width columns of prose on a phone are
 * unreadable, so the control is absent rather than present-and-disabled — an affordance you
 * can see but never use is worse than none.
 */
export const SPLIT_VIEW_MIN_WIDTH = "(min-width: 64rem)"

export interface SplitView {
  /** The author's PREFERENCE, which survives a narrow viewport. */
  layout: SplitViewLayout
  setLayout: (layout: SplitViewLayout) => void
  pane: SplitViewPane
  setPane: (pane: SplitViewPane) => void
  /** What is actually on screen: `layout`, demoted to `tabbed` on a narrow viewport. */
  effective: SplitViewLayout
  /** Is the viewport wide enough for the split to be offered at all? */
  wide: boolean
  showEditor: boolean
  showPreview: boolean
  /**
   * Put this on the pane CONTAINER, not on either pane: in the tabbed layout exactly one of
   * the two is mounted, so an id on the hidden one is a dangling `aria-controls` reference
   * (ignored by AT) the instant the author switches.
   */
  panesId: string
}

export interface UseSplitViewOptions {
  /** Layout to open in on a wide viewport. Narrow always opens tabbed. */
  defaultLayout?: SplitViewLayout
  /** Pane to open the tabbed layout on. */
  defaultPane?: SplitViewPane
}

/**
 * The state behind {@link SplitViewControl} — held by the HOST rather than by the control,
 * because the host is what renders the panes the control chooses between.
 */
export function useSplitView({
  defaultLayout = "tabbed",
  defaultPane = "edit",
}: UseSplitViewOptions = {}): SplitView {
  const wide = useMediaQuery(SPLIT_VIEW_MIN_WIDTH)
  const [layout, setLayout] = useState<SplitViewLayout>(defaultLayout)
  const [pane, setPane] = useState<SplitViewPane>(defaultPane)
  const panesId = useId()

  // The PREFERENCE survives a narrow viewport even though the layout cannot be shown there:
  // only the EFFECTIVE layout collapses, so widening the window restores the split instead of
  // silently demoting the author's choice.
  const effective: SplitViewLayout = wide ? layout : "tabbed"
  return {
    layout,
    setLayout,
    pane,
    setPane,
    effective,
    wide,
    showEditor: effective === "split" || pane === "edit",
    showPreview: effective === "split" || pane === "preview",
    panesId,
  }
}

export interface SplitViewControlProps {
  /** The state from {@link useSplitView}. */
  view: SplitView
  /**
   * What the two toggle groups are OF, for their accessible names — "Editor" yields
   * "Editor layout" and "Editor pane". Every surface that carries this control has a
   * different one of these on screen at once, and a screen-reader user picking a group out
   * of a rotor needs to know which.
   */
  subject: string
  /** Label on the edit toggle. The registrant-facing word differs per surface. */
  editLabel?: string
  previewLabel?: string
  className?: string
}

/**
 * The tab / split-view control: pick one pane at a time or both side by side, and — when
 * one at a time — which.
 *
 * Shared because it was written twice. The markdown document editor (notes, research,
 * discussions) and the registry signup-form builder had byte-for-byte the same two
 * `ToggleGroup`s, the same wide/narrow demotion and the same dangling-`aria-controls`
 * workaround, in two files that could drift apart — which is exactly the duplication `dry`
 * is about, since "how this control looks and behaves" is one piece of knowledge.
 *
 * It renders as a LEFT-ALIGNED row, and is meant to sit directly below its surface's header
 * rather than inside it. A view chooser is not a header action: it belongs to the body it
 * switches, so it reads left-to-right with the panes underneath, in the place the eye
 * arrives at before the content.
 */
export function SplitViewControl({
  view,
  subject,
  editLabel = "Edit",
  previewLabel = "Preview",
  className,
}: SplitViewControlProps): React.JSX.Element {
  const { layout, setLayout, pane, setPane, effective, wide, panesId } = view
  return (
    <div
      data-slot="split-view-control"
      className={cn("flex items-center gap-3", className)}
    >
      {wide && (
        <>
          <ToggleGroup
            aria-label={`${subject} layout`}
            value={[layout]}
            onValueChange={(next: string[]) => {
              // Base UI hands back an array and an empty one means "the pressed item was
              // clicked again". A segmented control always keeps a selection, so ignore it.
              const picked = next[0]
              if (picked) setLayout(picked as SplitViewLayout)
            }}
          >
            <ToggleGroupItem
              value="tabbed"
              aria-label="Single tabbed view"
              title="Single tabbed view"
            >
              <Square />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="split"
              aria-label="Side by side view"
              title="Side by side view"
            >
              <Columns2 />
            </ToggleGroupItem>
          </ToggleGroup>
          {effective === "tabbed" && <div aria-hidden className="h-5 w-px bg-apt-border" />}
        </>
      )}

      {/* In the split both panes are already visible, so a pane chooser would be a control
          with nothing to choose. */}
      {effective === "tabbed" && (
        <ToggleGroup
          aria-label={`${subject} pane`}
          value={[pane]}
          onValueChange={(next: string[]) => {
            const picked = next[0]
            if (picked) setPane(picked as SplitViewPane)
          }}
        >
          <ToggleGroupItem value="edit" aria-controls={panesId}>
            <Pencil />
            {editLabel}
          </ToggleGroupItem>
          <ToggleGroupItem value="preview" aria-controls={panesId}>
            <Eye />
            {previewLabel}
          </ToggleGroupItem>
        </ToggleGroup>
      )}
    </div>
  )
}
