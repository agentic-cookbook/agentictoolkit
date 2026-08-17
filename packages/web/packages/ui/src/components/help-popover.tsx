"use client"

import { CircleHelp, Info, Sparkles, type LucideIcon } from "lucide-react"
import type { ReactElement } from "react"

import { PopoverContent } from "./popover"
import type { HelpEntry, HelpFlavor } from "./help-content"

/** One table, so adding a flavor is one entry and the compiler finds every place
 *  that has to care. `label` is the icon's accessible name — the icon is the only
 *  thing that says what the popover is for, so it is not decorative. */
const FLAVORS: Record<HelpFlavor, { icon: LucideIcon; label: string }> = {
  help: { icon: CircleHelp, label: "Help" },
  info: { icon: Info, label: "Information" },
  new: { icon: Sparkles, label: "What's new" },
}

export interface HelpPopoverContentProps {
  entry: HelpEntry
  side?: "top" | "bottom" | "left" | "right"
  align?: "start" | "center" | "end"
}

/** The panel half of a help popover: the flavor icon, an optional title, and the
 *  copy. Composes PopoverContent with its arrow turned on. */
export function HelpPopoverContent({
  entry,
  side = "bottom",
  align = "start",
}: HelpPopoverContentProps): ReactElement {
  const flavor = entry.flavor ?? "info"
  const { icon: Icon, label } = FLAVORS[flavor]
  return (
    // `aria-label` on the panel, not just on the icon: PopoverContent's Popup
    // hard-wires `role="dialog"`, and Base UI derives a dialog's accessible name
    // only from a `Popover.Title`/`Popover.Description` descendant — neither of
    // which this renders. Without it the panel announces as an unnamed dialog,
    // and the title (when there is one) is the flavor's job to qualify anyway.
    <PopoverContent
      arrow
      side={side}
      align={align}
      className="w-80"
      aria-label={entry.title ? `${label}: ${entry.title}` : label}
    >
      <div className="flex gap-2.5">
        {/* Decorative HERE, though the flavor is not decorative information: the
            same `label` is the dialog's accessible name above, so labelling the
            icon too would announce the flavor twice on open. */}
        <Icon
          data-help-flavor={flavor}
          aria-hidden="true"
          className="mt-0.5 size-4 shrink-0 text-apt-text-muted"
        />
        <div className="min-w-0">
          {entry.title && (
            <p
              data-slot="help-popover-title"
              className="mb-1 font-medium text-apt-text"
            >
              {entry.title}
            </p>
          )}
          <p className="text-apt-text-muted">{entry.body}</p>
        </div>
      </div>
    </PopoverContent>
  )
}
