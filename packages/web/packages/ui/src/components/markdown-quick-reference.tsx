"use client"

import * as React from "react"
import { Fragment } from "react"
import { BookText } from "lucide-react"

import { cn } from "../lib/utils"
import { buttonVariants } from "./button"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { fieldCaptionClass } from "../lib/typography"

// Common GitHub-flavoured markdown, shown in the quick-reference popover. One
// authoritative list (DRY) so every editor surfaces the same cheatsheet.
const MARKDOWN_SYNTAX: ReadonlyArray<{ label: string; syntax: string }> = [
  { label: "Headings", syntax: "# H1\n## H2\n### H3" },
  { label: "Bold", syntax: "**bold text**" },
  { label: "Italic", syntax: "_italic text_" },
  { label: "Inline code", syntax: "`inline code`" },
  { label: "Code block", syntax: "```ts\ncode\n```" },
  { label: "Bullet list", syntax: "- one\n- two" },
  { label: "Numbered list", syntax: "1. one\n2. two" },
  { label: "Link", syntax: "[label](https://url)" },
  { label: "Blockquote", syntax: "> quoted text" },
]

type PopoverContentProps = React.ComponentProps<typeof PopoverContent>

// A standalone toolbar control: an outline Button that opens a dismissible
// popover listing common markdown syntax. Built on the shared Popover, so it
// inherits outside-click + Escape dismissal and focus restore to the trigger.
// Reusable in any editor toolbar; wired into MarkdownEditor by default.
export function MarkdownQuickReference({
  side = "bottom",
  align = "end",
  triggerLabel = "Markdown",
  className,
}: {
  side?: PopoverContentProps["side"]
  align?: PopoverContentProps["align"]
  /** Visible text on the trigger button. */
  triggerLabel?: React.ReactNode
  className?: string
}) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label="Markdown quick reference"
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          className,
        )}
      >
        <BookText data-icon="inline-start" />
        {triggerLabel}
      </PopoverTrigger>
      <PopoverContent side={side} align={align} className="w-80">
        <div className="space-y-3">
          <p className={fieldCaptionClass}>
            Markdown quick reference
          </p>
          <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2">
            {MARKDOWN_SYNTAX.map(({ label, syntax }) => (
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
