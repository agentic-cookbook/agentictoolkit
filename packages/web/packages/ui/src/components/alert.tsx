import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "../lib/utils"

// Inline callout — a bordered, tonal box with an optional leading icon, title,
// and description. Themed from `apt-*` status tokens.
const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[1.25rem_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5",
  {
    variants: {
      variant: {
        default:
          "border-apt-border bg-apt-surface text-apt-text [&>svg]:text-apt-text-muted",
        info: "border-apt-blue/40 bg-apt-blue/10 text-apt-text [&>svg]:text-apt-blue",
        success:
          "border-apt-green/40 bg-apt-green/10 text-apt-text [&>svg]:text-apt-green",
        error:
          "border-apt-red/40 bg-apt-red/10 text-apt-text [&>svg]:text-apt-red",
        accent:
          "border-apt-gold/40 bg-apt-gold/10 text-apt-text [&>svg]:text-apt-gold",
      },
    },
    defaultVariants: { variant: "default" },
  },
)

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      role="alert"
      className={cn(alertVariants({ variant, className }))}
      {...props}
    />
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn("col-start-2 font-medium text-apt-text", className)}
      {...props}
    />
  )
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("col-start-2 text-sm text-apt-text-muted", className)}
      {...props}
    />
  )
}

export { Alert, AlertTitle, AlertDescription, alertVariants }
