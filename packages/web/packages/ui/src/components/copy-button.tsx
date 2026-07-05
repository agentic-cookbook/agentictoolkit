"use client"

import { Check, Copy } from "lucide-react"

import { useClipboard } from "../hooks/useClipboard"
import { cn } from "../lib/utils"
import { Button } from "./button"

// The clipboard icon button — writes getText() (resolved at click time, so it
// reflects the current filter/selection) and flashes a success check. Built on
// the shared Button + useClipboard so every "copy this" affordance is one
// component. Clipboard failure (insecure context, denied permission) is a
// silent no-op — useClipboard already swallows it.
export interface CopyButtonProps {
  /** Produces the text to copy at click time. Empty string = nothing copied. */
  getText: () => string
  /** Accessible name for the button (also its hover title). */
  label: string
  className?: string
}

export function CopyButton({ getText, label, className }: CopyButtonProps) {
  const { copied, copy } = useClipboard(1200)
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={label}
      title={copied ? "Copied!" : label}
      className={cn("size-6 text-apt-text-muted", copied && "text-apt-green", className)}
      onClick={() => {
        const text = getText()
        if (text) void copy(text)
      }}
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
    </Button>
  )
}
