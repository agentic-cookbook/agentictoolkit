"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "../lib/utils"

/**
 * base-ui switch, themed from `apt-*` tokens (gold when on). Pass `checked` +
 * `onCheckedChange` for a controlled toggle, or `defaultChecked` for uncontrolled.
 */
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent px-0.5 transition-colors outline-none",
        "data-[checked]:bg-apt-gold data-[unchecked]:bg-apt-input",
        "focus-visible:ring-2 focus-visible:ring-apt-gold/40",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none size-4 rounded-full bg-apt-text shadow-sm transition-transform data-[checked]:translate-x-4 data-[unchecked]:translate-x-0"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
