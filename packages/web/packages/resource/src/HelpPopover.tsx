"use client";

import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { Popover } from "@base-ui/react/popover";
import { cn } from "@agenticdevelopertoolkit/ui/lib/utils";
import { quietControlClass } from "@agenticdevelopertoolkit/ui/lib/quiet-control";

/**
 * A "?" trigger that opens a small popover with contextual help. Shared by the
 * feature button bars (and previously the feature tab row).
 *
 * The LOOK is the family's quiet-control grammar and is applied unconditionally;
 * `triggerClassName` ADDS the host's own row metrics (`px-1`, `ml-1`, `shrink-0`)
 * on top of it. It used to be a default that a host REPLACED, and every host that
 * passed one restated the muted/hover pair by hand and then dropped the focus
 * treatment — which is how three spellings of one trigger ended up in the fleet.
 */
export function HelpPopover({
  children,
  triggerClassName,
}: {
  children: ReactNode;
  triggerClassName?: string;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label="About this section"
        className={cn(quietControlClass, triggerClassName)}
      >
        <CircleHelp size={16} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
          <Popover.Popup className="max-w-sm rounded-lg border border-apt-border bg-apt-surface p-3 text-sm leading-relaxed text-apt-text-muted shadow-lg outline-none">
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
