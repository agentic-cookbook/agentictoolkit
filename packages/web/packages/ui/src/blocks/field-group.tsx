"use client"

import type { ReactNode } from "react"

import { cn } from "../lib/utils"
import { fieldCaptionClass } from "../lib/typography"

// A titled group of fields inside an editor pane: a bordered card with an
// uppercase mono heading and an optional trailing slot (status text, actions).
export function FieldGroup({
  title,
  trailing,
  children,
  className,
}: {
  title: ReactNode
  trailing?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-lg border border-apt-border bg-apt-surface-2/40 p-3",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className={fieldCaptionClass}>
          {title}
        </h3>
        {trailing}
      </div>
      {children}
    </section>
  )
}
