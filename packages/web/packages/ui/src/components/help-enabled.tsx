"use client"

import { Info } from "lucide-react"
import type { ReactElement, ReactNode } from "react"

import { cn } from "../lib/utils"
import { Popover, PopoverTrigger } from "./popover"
import { HelpPopoverContent } from "./help-popover"
import { useHelpEntry, type HelpEntry } from "./help-content"

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
  /** Copy to use when the provider has no entry for `id`, as an `info` entry.
   *
   *  For a caller that can derive the words from somewhere other than the help
   *  store and would rather show them than nothing. The store still wins when it
   *  has the id; this only replaces the plain-text-plus-console-warn path. */
  fallback?: string
}

/**
 * Marks text as help-enabled: it highlights on hover or focus, reveals a small
 * "i" badge, and opens a popover explaining itself.
 *
 * Focus as well as hover, deliberately — a hover-only affordance does not exist
 * for a keyboard or a touch reader. The badge is always rendered and merely
 * transparent, so revealing it reflows nothing.
 */
export function HelpEnabled({
  id,
  children,
  className,
  fallback,
}: HelpEnabledProps): ReactElement {
  const stored = useHelpEntry(id)
  const entry: HelpEntry | undefined =
    stored ?? (fallback ? { body: fallback, flavor: "info" } : undefined)

  if (!entry) {
    // Not a throw: this sits in the header on every page of every site, so a
    // typo must not be reported by white-screening the fleet.
    if (!warned.has(id)) {
      warned.add(id)
      console.warn(`[HelpEnabled] no help entry for id "${id}" — rendering plain text`)
    }
    // `className` rides along even here. The caller's class is the element's
    // LAYOUT, not decoration for the help affordance: the header passes
    // `.adh-header__page-title`, which is what centres the title, clips it to an
    // ellipsis and hides it on mobile. Returning a bare fragment dropped all
    // three, so one missing help entry moved the site name to the left of every
    // page it appeared on.
    //
    // `data-slot` marks it as the unresolved variant, because carrying the class
    // means carrying whatever the caller attached to it for the interactive case.
    // A caller whose class turns on a pointer cursor needs a hook to turn it back
    // off on a span that opens nothing.
    return (
      <span data-slot="help-enabled-plain" className={className}>
        {children}
      </span>
    )
  }

  return (
    <Popover>
      <PopoverTrigger
        data-slot="help-enabled"
        className={cn(
          "group -mx-1 inline-flex items-center gap-1 rounded-sm px-1 text-left",
          "transition-colors hover:bg-apt-surface-2 focus-visible:bg-apt-surface-2",
          // The family's GOLD ring, the same pair `quietControlClass` documents and
          // the topic-detail chevrons, the split divider, the dialog and toast close
          // buttons, the collapse toggles and the tree rows all use. Not
          // `ring-apt-border`: that is the popup's own border colour, so the ring
          // would read as chrome rather than as focus, and this element would be the
          // one place in the family where keyboard focus looks different.
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-apt-gold/40",
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
