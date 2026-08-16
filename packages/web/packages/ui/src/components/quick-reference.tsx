"use client"

import * as React from "react"
import { Fragment } from "react"
import { BookText } from "lucide-react"

import { cn } from "../lib/utils"
import { buttonVariants } from "./button"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { fieldCaptionClass } from "../lib/typography"

/** One row of a cheatsheet: what it's called, and how it's written. */
export type SyntaxEntry = { label: string; syntax: string }

type PopoverContentProps = React.ComponentProps<typeof PopoverContent>

/**
 * A toolbar control that opens a dismissible popover listing a syntax cheatsheet.
 *
 * The SHELL is here; the entries belong to whoever owns the language. Built on the
 * shared Popover, so it inherits outside-click + Escape dismissal and focus restore
 * to the trigger.
 *
 * This started as the body of `MarkdownQuickReference` and was lifted out when a
 * second language wanted the same control (ink, in the personas demo-chat editor).
 * Only the list and two presentational widths differ, and a cheatsheet that renders
 * differently per language is a cheatsheet the reader has to re-learn — so the
 * markup is one thing rather than two that drift.
 */
export function SyntaxQuickReference({
  title,
  entries,
  ariaLabel,
  triggerLabel,
  side = "bottom",
  align = "end",
  className,
  contentClassName = "w-80",
  columnsClassName = "grid-cols-[7rem_1fr]",
}: {
  /** The popover's heading, e.g. "Markdown quick reference". */
  title: string
  entries: ReadonlyArray<SyntaxEntry>
  /** The trigger's accessible name. Usually the title. */
  ariaLabel: string
  /** Visible text on the trigger button. */
  triggerLabel?: React.ReactNode
  side?: PopoverContentProps["side"]
  align?: PopoverContentProps["align"]
  className?: string
  /** Popover width. Widen it for a language whose examples run long. */
  contentClassName?: string
  /** The label column's width, for the same reason. */
  columnsClassName?: string
}) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={ariaLabel}
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          className,
        )}
      >
        <BookText data-icon="inline-start" />
        {triggerLabel}
      </PopoverTrigger>
      <PopoverContent side={side} align={align} className={contentClassName}>
        <div className="space-y-3">
          <p className={fieldCaptionClass}>{title}</p>
          <dl className={cn("grid gap-x-3 gap-y-2", columnsClassName)}>
            {entries.map(({ label, syntax }) => (
              <Fragment key={label}>
                <dt className="text-sm text-apt-text-muted">{label}</dt>
                <dd className="min-w-0">
                  <code className="block whitespace-pre-wrap font-mono text-xs leading-snug text-apt-text">
                    {syntax}
                  </code>
                </dd>
              </Fragment>
            ))}
          </dl>
        </div>
      </PopoverContent>
    </Popover>
  )
}
