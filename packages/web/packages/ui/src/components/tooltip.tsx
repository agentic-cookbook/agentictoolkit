"use client"

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"

import { cn } from "../lib/utils"

// base-ui tooltip, themed from `apt-*` tokens. Wrap the app (or a subtree) in a
// single <TooltipProvider> so hovers share one open delay.
function TooltipProvider({
  delay = 200,
  ...props
}: TooltipPrimitive.Provider.Props) {
  return (
    <TooltipPrimitive.Provider data-slot="tooltip-provider" delay={delay} {...props} />
  )
}

function Tooltip(props: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger(props: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  side = "top",
  sideOffset = 6,
  align = "center",
  arrow = true,
  children,
  ...props
}: TooltipPrimitive.Popup.Props &
  Pick<TooltipPrimitive.Positioner.Props, "side" | "sideOffset" | "align"> & {
    /** Show the little pointer diamond. Default true. Pass false for left/right-side
     *  tooltips where the arrow's top/bottom-only positioning would overlap the text. */
    arrow?: boolean
  }) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        className="z-50"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "z-50 max-w-xs rounded-md border border-apt-border bg-apt-surface-2 px-2.5 py-1.5 text-xs text-apt-text shadow-md outline-none",
            className,
          )}
          {...props}
        >
          {children}
          {arrow && (
            <TooltipPrimitive.Arrow className="size-2 rotate-45 rounded-[2px] border-r border-b border-apt-border bg-apt-surface-2 data-[side=top]:-bottom-1 data-[side=bottom]:-top-1 data-[side=bottom]:rotate-[225deg]" />
          )}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
