"use client"

// The reader's last row: a hairline rule, a "> View source" text toggle, and the
// document's raw source revealed underneath. It is deliberately the quietest
// thing on the page — a reader who wants the markdown will look for it, and one
// who doesn't should never notice it.
//
// This does NOT compose `Disclosure`. Disclosure is a framed card — rounded
// border, raised surface, `text-sm font-medium` title, a ruled content box — and
// its three consumers (DeleteEntitySection, the API explorer's three panels, the
// showcase) all want exactly that. Reaching this look through it would mean
// cancelling every visual decision it makes: the card chrome, the header padding,
// the chevron's size and colour, the title's family/size/weight/colour, and the
// content frame — nine overrides to keep ~20 lines of open/close state, and a
// standing coupling that would let a future Disclosure restyle silently break
// the document reader. Two disclosures in the toolkit is not a DRY violation:
// they encode different knowledge (a framed section vs. an inline text toggle).

import type { HTMLAttributes, ReactNode } from "react"
import { useId, useState } from "react"
import { ChevronRight } from "lucide-react"

import { cn } from "../lib/utils"

/** The row's own chrome: the rule that separates it from the document above. */
export const VIEW_SOURCE_DISCLOSURE_CLASS =
  "mt-8 border-t border-[var(--color-border-subtle)] pt-4"

/** The trigger. Mono micro-type, dim until hovered — chrome, not content. */
export const VIEW_SOURCE_TRIGGER_CLASS =
  "flex items-center gap-1.5 font-mono text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text-secondary)]"

/** The revealed source. Wraps rather than truncates; scrolls only when a single
 *  unbreakable token (a long URL, a table rule) is wider than the column. */
export const VIEW_SOURCE_PRE_CLASS =
  "mt-3 p-4 rounded-md bg-[var(--color-surface-raised)] border border-[var(--color-border-subtle)] overflow-x-auto font-mono text-xs text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap"

export interface ViewSourceDisclosureProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** The raw document text to reveal. Rendered verbatim, never parsed. */
  source: string
  /** The trigger's text. Defaults to "View source". */
  label?: ReactNode
  /** Start expanded. Uncontrolled — the reader owns the state from then on. */
  defaultOpen?: boolean
}

export function ViewSourceDisclosure({
  source,
  label = "View source",
  defaultOpen = false,
  className,
  ...rest
}: ViewSourceDisclosureProps) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()

  return (
    <div className={cn(VIEW_SOURCE_DISCLOSURE_CLASS, className)} {...rest}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        // Only while the panel exists. `aria-controls` is an IDREF, and one
        // pointing at nothing is an authoring error (axe: aria-valid-attr-value),
        // not a harmless no-op. The alternative — rendering the `<pre>` always and
        // hiding it — would put every document's full source into every prerendered
        // page; `aria-expanded` alone already announces the state.
        aria-controls={open ? panelId : undefined}
        className={VIEW_SOURCE_TRIGGER_CLASS}
      >
        <ChevronRight
          className={cn(
            "h-3 w-3 transition-transform duration-150",
            open && "rotate-90",
          )}
          strokeWidth={2.5}
        />
        {label}
      </button>
      {open && (
        <pre id={panelId} className={VIEW_SOURCE_PRE_CLASS}>
          {source}
        </pre>
      )}
    </div>
  )
}
