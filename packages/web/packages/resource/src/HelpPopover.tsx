"use client";

import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { Popover } from "@base-ui/react/popover";

/**
 * A "?" trigger that opens a small popover with contextual help. Shared by the
 * feature button bars (and previously the feature tab row). `triggerClassName`
 * lets the host align the icon to its own row metrics.
 */
export function HelpPopover({
  children,
  triggerClassName = "flex items-center px-1 text-apt-text-muted transition-colors hover:text-apt-text",
}: {
  children: ReactNode;
  triggerClassName?: string;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger aria-label="About this section" className={triggerClassName}>
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
