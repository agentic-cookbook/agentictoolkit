"use client"

import { Popover as PopoverPrimitive } from "@base-ui/react/popover"

import { cn } from "../lib/utils"

// base-ui popover, themed from `apt-*` tokens. Compose:
//   <Popover><PopoverTrigger/><PopoverContent>…</PopoverContent></Popover>
function Popover(props: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger(props: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

function PopoverContent({
  className,
  side = "bottom",
  sideOffset = 8,
  align = "center",
  arrow = false,
  children,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<PopoverPrimitive.Positioner.Props, "side" | "sideOffset" | "align"> & {
    /** Show the little pointer diamond. Default false: this component has consumers
     *  that predate the arrow, and turning it on for them is a restyle nobody asked
     *  for. Opt in per call site — HelpPopoverContent does. */
    arrow?: boolean
  }) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        className="z-50"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            "z-50 w-72 max-w-(--available-width) rounded-lg border border-apt-border bg-apt-surface p-4 text-sm text-apt-text shadow-lg outline-none",
            className,
          )}
          {...props}
        >
          {children}
          {arrow && (
            <PopoverPrimitive.Arrow
              data-slot="popover-arrow"
              className="size-2 rotate-45 rounded-[2px] border-r border-b border-apt-border bg-apt-surface data-[side=bottom]:-top-1 data-[side=bottom]:rotate-[225deg] data-[side=top]:-bottom-1"
            />
          )}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

export { Popover, PopoverTrigger, PopoverContent }
