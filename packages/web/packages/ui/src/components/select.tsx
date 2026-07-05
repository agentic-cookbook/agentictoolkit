import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "../lib/utils";
import { fieldShellClass } from "./input";

/**
 * A native <select> styled to match the Input primitive (`apt-*` tokens), with a
 * custom chevron. Kept native (rather than a base-ui listbox) for simplicity and
 * accessibility — yagni until a richer control is needed.
 */
function Select({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select
        data-slot="select"
        className={cn(
          fieldShellClass,
          "flex h-9 w-full min-w-0 appearance-none px-3 py-2 pr-9 text-sm text-apt-text transition-colors outline-none",
          "focus-visible:border-apt-gold focus-visible:ring-2 focus-visible:ring-apt-gold/25",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-apt-text-muted" />
    </div>
  );
}

export { Select };
