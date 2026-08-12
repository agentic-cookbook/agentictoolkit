"use client"

import type { ReactNode } from "react"
import { CircleHelp } from "lucide-react"

import { cn } from "../lib/utils"
import { quietControlClass } from "../lib/quiet-control"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "../components/popover"

// The /home content header: a gold-mono title (e.g. "All ecosystems"), an
// optional right-aligned "?" help popover, and an optional actions slot. Matches
// hub's FeatureTitle.
export function SectionHeader({
  eyebrow,
  title,
  help,
  actions,
  className,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  help?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="space-y-1">
        {eyebrow && (
          <div className="font-mono text-[0.65rem] uppercase tracking-wider text-apt-text-dim">
            {eyebrow}
          </div>
        )}
        <h2 className="font-mono text-sm font-medium tracking-wide text-apt-gold">
          {title}
        </h2>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        {help && (
          <Popover>
            <PopoverTrigger
              aria-label="About this section"
              className={quietControlClass}
            >
              <CircleHelp size={16} />
            </PopoverTrigger>
            <PopoverContent side="bottom" align="end" className="w-72">
              {help}
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  )
}
