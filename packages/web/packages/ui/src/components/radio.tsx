"use client"

import * as React from "react"
import { RadioGroup as RadioGroupPrimitive } from "@base-ui/react/radio-group"
import { Radio as RadioPrimitive } from "@base-ui/react/radio"

import { cn } from "../lib/utils"

// Base UI radio group, themed from `apt-*` tokens (gold dot when selected).
function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive>) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn("grid gap-2.5", className)}
      {...props}
    />
  )
}

function RadioGroupItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioPrimitive.Root>) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-full border border-apt-border bg-apt-bg transition-colors outline-none",
        "focus-visible:border-apt-gold focus-visible:ring-2 focus-visible:ring-apt-gold/25",
        "data-[checked]:border-apt-gold",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <RadioPrimitive.Indicator className="size-2 rounded-full bg-apt-gold data-[unchecked]:hidden" />
    </RadioPrimitive.Root>
  )
}

export { RadioGroup, RadioGroupItem }
