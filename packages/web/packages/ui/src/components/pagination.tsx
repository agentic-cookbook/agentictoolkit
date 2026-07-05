"use client"

import { cn } from "../lib/utils"
import { Button } from "./button"

// The list pager — Prev / "Page X of Y" / Next. Controlled: the host owns
// `page` and hands us the bounds. Renders nothing when there is only one page,
// so hosts never wrap it in their own visibility conditional.
export interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  className?: string
}

export function Pagination({ page, totalPages, onPageChange, className }: PaginationProps) {
  if (totalPages <= 1) return null
  return (
    <nav
      aria-label="Pagination"
      className={cn("flex items-center justify-center gap-2", className)}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Prev
      </Button>
      <span className="px-1 font-mono text-xs text-apt-text-muted">
        Page {page} of {totalPages}
      </span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </Button>
    </nav>
  )
}
