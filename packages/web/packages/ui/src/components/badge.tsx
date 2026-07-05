import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../lib/utils"

// Status chip — a 1:1 match of the deployed header badge (`.adh-header__badge`):
// mono 0.6rem, weight 500, 0.08em tracking, uppercase, pill, 1px border with
// border + text sharing the tone colour. Tones mirror the header
// (neutral / accent / orange = Development Preview / blue = Coming Soon).
const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full border bg-transparent px-[0.45rem] py-[0.15rem] font-mono text-[0.6rem] font-medium uppercase leading-[1.4] tracking-[0.08em] [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        neutral: "border-apt-border text-apt-text-dim",
        accent: "border-apt-gold text-apt-gold",
        orange: "border-apt-orange text-apt-orange",
        blue: "border-apt-blue text-apt-blue",
        success: "border-apt-green text-apt-green",
        error: "border-apt-red text-apt-red",
      },
    },
    defaultVariants: { variant: "neutral" },
  },
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, className }))}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
