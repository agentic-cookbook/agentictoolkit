import { Loader2 } from "lucide-react"

import { cn } from "../lib/utils"

// Indeterminate loading spinner. Size/colour via className (defaults to a
// muted 1rem spinner). Renders a lucide loader with a spin animation.
function Spinner({
  className,
  ...props
}: React.ComponentProps<typeof Loader2>) {
  return (
    <Loader2
      role="status"
      aria-label="Loading"
      className={cn("size-4 animate-spin text-apt-text-muted", className)}
      {...props}
    />
  )
}

export { Spinner }
