import type { ReactNode } from "react"

import { cn } from "../lib/utils"

/** The display micro-heading treatment — smaller, dimmer, and wider-tracked
 *  than `fieldCaptionClass` (the FORM caption). One home so every pane head
 *  and in-card section label changes in exactly one place. */
export const sectionLabelClass =
  "font-mono text-[0.625rem] font-medium uppercase tracking-[0.1em] text-apt-text-dim"

// A display section micro-heading with an optional trailing slot. Distinct
// from SectionHeader (the gold page/section title) and from Field captions —
// this is the quiet in-pane label ("RECENT ACTIVITY", "SOCIAL LINKS").
export function SectionLabel({
  children,
  trailing,
  className,
}: {
  children: ReactNode
  trailing?: ReactNode
  className?: string
}) {
  // `className` always lands on the OUTERMOST element so a caller's layout class
  // (e.g. `mb-2`) means the same thing whether or not `trailing` is passed:
  // without trailing the label div IS the root; with trailing the flex row is.
  if (trailing == null) {
    return <div className={cn(sectionLabelClass, className)}>{children}</div>
  }
  return (
    <div className={cn("flex items-center justify-between gap-2", className)}>
      <span className={sectionLabelClass}>{children}</span>
      {trailing}
    </div>
  )
}
