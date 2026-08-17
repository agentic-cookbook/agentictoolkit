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
              className={cn(
                // A square with only its right and bottom borders drawn, rotated so
                // those two form the tip. `bg-apt-surface` matches the popup exactly,
                // so the undrawn half of the square disappears into it.
                "size-2 rounded-[2px] border-r border-b border-apt-border bg-apt-surface",
                // One rule per side, because the arrow sits on the edge FACING the
                // trigger and points at it — a side with no rule leaves the diamond
                // unrotated and un-nudged, i.e. centred inside the popup pointing the
                // wrong way. All four `side` values are reachable: `side` is a public
                // prop of both PopoverContent and HelpPopoverContent.
                "data-[side=top]:-bottom-1 data-[side=top]:rotate-45",
                "data-[side=bottom]:-top-1 data-[side=bottom]:rotate-[225deg]",
                "data-[side=left]:-right-1 data-[side=left]:rotate-[315deg]",
                "data-[side=right]:-left-1 data-[side=right]:rotate-[135deg]",
              )}
            />
          )}
        </PopoverPrimitive.Popup>
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

export { Popover, PopoverTrigger, PopoverContent }
