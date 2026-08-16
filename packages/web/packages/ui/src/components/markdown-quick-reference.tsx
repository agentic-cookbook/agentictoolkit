"use client"

import * as React from "react"

import { PopoverContent } from "./popover"
import { SyntaxQuickReference } from "./quick-reference"

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
// popover listing common markdown syntax. Wired into MarkdownEditor by default.
// The markup lives in SyntaxQuickReference, which ink's editor shares; what is
// markdown's own is the list above.
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
    <SyntaxQuickReference
      title="Markdown quick reference"
      ariaLabel="Markdown quick reference"
      entries={MARKDOWN_SYNTAX}
      triggerLabel={triggerLabel}
      side={side}
      align={align}
      className={className}
    />
  )
}
