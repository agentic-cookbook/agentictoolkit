import * as React from "react"

import { cn } from "../lib/utils"

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    // eslint-disable-next-line jsx-a11y/label-has-associated-control -- reusable Label primitive; htmlFor/nesting is supplied by consumers via ...props
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm font-medium leading-none text-apt-text select-none",
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
