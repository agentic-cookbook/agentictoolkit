"use client"

import * as React from "react"

import { cn } from "../lib/utils"

/**
 * A shadcn-style progress bar — a track with an indicator filled to `value`
 * (0–100). Kept as a self-contained accessible element (role="progressbar" with
 * aria-valuenow/min/max) rather than wrapping a primitive, so it needs no extra
 * runtime dependency. Style the fill via `indicatorClassName` (e.g. amber while
 * building, green when complete).
 */
function Progress({
  value = 0,
  className,
  indicatorClassName,
  ...props
}: React.ComponentProps<"div"> & { value?: number; indicatorClassName?: string }) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      data-slot="progress"
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-apt-surface-2", className)}
      {...props}
    >
      <div
        data-slot="progress-indicator"
        className={cn(
          // calc(): honours the dev-only 10x-slow switch (`--apt-anim-scale`, applied to <html>);
          // the `, 1` fallback keeps this a plain 300ms everywhere else.
          "h-full w-full rounded-full bg-apt-gold transition-transform duration-[calc(300ms*var(--apt-anim-scale,1))] ease-out",
          indicatorClassName,
        )}
        style={{ transform: `translateX(-${100 - pct}%)` }}
      />
    </div>
  )
}

export { Progress }
