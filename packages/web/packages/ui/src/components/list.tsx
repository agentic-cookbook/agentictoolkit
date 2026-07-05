import * as React from "react";

import { cn } from "../lib/utils";

/**
 * A simple bordered list with row dividers — the shadcn-style primitive for
 * flat collections (e.g. team members). Compose with `ListItem` for rows.
 */
function List({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="list"
      className={cn(
        "flex flex-col divide-y divide-apt-border overflow-hidden rounded-lg border border-apt-border",
        className,
      )}
      {...props}
    />
  );
}

function ListItem({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="list-item"
      className={cn("flex min-h-9 items-center gap-3 px-3 py-1.5", className)}
      {...props}
    />
  );
}

export { List, ListItem };
