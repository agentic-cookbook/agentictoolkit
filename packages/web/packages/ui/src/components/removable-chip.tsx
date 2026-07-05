"use client"

import * as React from "react"
import { X } from "lucide-react"

import { Badge, type badgeVariants } from "./badge"
import { cn } from "../lib/utils"
import type { VariantProps } from "class-variance-authority"

/**
 * A Badge with a trailing ✕ remove affordance — the one home for the
 * "removable chip" treatment (recipient chips, tag/category chips). The chip
 * body is the Badge; the ✕ is a real button carrying `removeLabel` as its
 * accessible name, so chips read "<value>, Remove <value>" to AT.
 */
export function RemovableChip({
  children,
  onRemove,
  removeLabel,
  variant = "neutral",
  disabled = false,
  className,
  ...props
}: {
  children: React.ReactNode
  onRemove: () => void
  /** Accessible name for the remove button (e.g. `Remove ${value}`). */
  removeLabel: string
  disabled?: boolean
} & Omit<React.ComponentProps<"span">, "children"> &
  VariantProps<typeof badgeVariants>): React.ReactElement {
  return (
    <Badge variant={variant} className={cn("flex items-center gap-1", className)} {...props}>
      {children}
      <button
        type="button"
        aria-label={removeLabel}
        disabled={disabled}
        onClick={onRemove}
        className="text-apt-text-muted hover:text-apt-text disabled:pointer-events-none"
      >
        <X size={11} aria-hidden />
      </button>
    </Badge>
  )
}
