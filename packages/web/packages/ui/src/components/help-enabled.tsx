"use client"

import { Info } from "lucide-react"
import type { ReactElement, ReactNode } from "react"

import { cn } from "../lib/utils"
import { Popover, PopoverTrigger } from "./popover"
import { HelpPopoverContent } from "./help-popover"
import { useHelpEntry } from "./help-content"

/** Ids already warned about, so a component rendered on every page warns once
 *  rather than once per render.
 *
 *  Once per id is the whole of the throttling — there is deliberately no
 *  `NODE_ENV !== 'production'` guard around the warning. A guard like that cannot
 *  work in a package that ships a prebuilt `dist`: esbuild substitutes
 *  `process.env.NODE_ENV` at THIS package's build time, not the consumer's, so the
 *  emitted `dist/components/help-enabled.js` had the condition folded away to
 *  always-true — a check that reads as conditional and is not. (`ui` also carries no
 *  `@types/node`, so the expression does not even typecheck here.) A missing help
 *  entry is a real misconfiguration, and one console line per bad id is the right
 *  size of complaint in any environment. */
const warned = new Set<string>()

export interface HelpEnabledProps {
  /** The key into the site's help copy. */
  id: string
  /** TEXT — a headline or a label. Not a control: the whole region becomes the
   *  popover's trigger, so a button or link inside it would lose its own click
   *  (and nest one interactive element inside another). */
  children: ReactNode
  className?: string
}

/**
 * Marks text as help-enabled: it highlights on hover or focus, reveals a small
 * "i" badge, and opens a popover explaining itself.
 *
 * Focus as well as hover, deliberately — a hover-only affordance does not exist
 * for a keyboard or a touch reader. The badge is always rendered and merely
 * transparent, so revealing it reflows nothing.
 */
export function HelpEnabled({ id, children, className }: HelpEnabledProps): ReactElement {
  const entry = useHelpEntry(id)

  if (!entry) {
    // Not a throw: this sits in the header on every page of every site, so a
    // typo must not be reported by white-screening the fleet.
    if (!warned.has(id)) {
      warned.add(id)
      console.warn(`[HelpEnabled] no help entry for id "${id}" — rendering plain text`)
    }
    return <>{children}</>
  }

  return (
    <Popover>
      <PopoverTrigger
        data-slot="help-enabled"
        className={cn(
          "group -mx-1 inline-flex items-center gap-1 rounded-sm px-1 text-left",
          "transition-colors hover:bg-apt-surface-2 focus-visible:bg-apt-surface-2",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apt-border",
          className,
        )}
      >
        {children}
        <Info
          data-slot="help-enabled-badge"
          aria-hidden="true"
          className={cn(
            "size-3 shrink-0 opacity-0 transition-opacity",
            "group-hover:opacity-70 group-focus-visible:opacity-70",
            "group-data-[popup-open]:opacity-70",
          )}
        />
      </PopoverTrigger>
      <HelpPopoverContent entry={entry} />
    </Popover>
  )
}
