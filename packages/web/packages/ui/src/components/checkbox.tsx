"use client";

import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { Check } from "lucide-react";

import { cn } from "../lib/utils";

/**
 * Checkbox styled to match the Input/Select primitives (`apt-*` tokens). Thin
 * wrapper over @base-ui/react/checkbox: pass `checked` + `onCheckedChange` for a
 * controlled box, or `defaultChecked` for uncontrolled.
 */
function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer flex size-4 shrink-0 items-center justify-center rounded border border-apt-border bg-apt-bg text-apt-bg transition-colors outline-none",
        "focus-visible:border-apt-gold focus-visible:ring-2 focus-visible:ring-apt-gold/25",
        "data-[checked]:border-apt-gold data-[checked]:bg-apt-gold",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current"
      >
        <Check className="size-3" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
