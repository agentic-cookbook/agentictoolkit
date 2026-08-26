'use client'

// A small online/offline indicator for a user (messaging P5, DM UI). Green dot =
// online; a hollow, dimmed dot = offline. The state is exposed to assistive tech
// through an sr-only label, and a Tooltip surfaces "Online" / "Last seen …" on
// hover/focus. Composes the shared @agenticdevelopertoolkit/ui Tooltip so it reads identically
// to the rest of the chrome. NOTE: a <TooltipProvider> ancestor is required — the
// DM list / thread / panel supply one.

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@agenticdevelopertoolkit/ui/components/tooltip'
import { cx, formatRelativeTime } from './util'

/** The presence label for a user, e.g. "Online" or "Last seen 3 minutes ago". */
function presenceLabel(online: boolean, lastSeenAt: string | null): string {
  if (online) return 'Online'
  if (lastSeenAt) {
    const rel = formatRelativeTime(lastSeenAt)
    return rel ? `Last seen ${rel}` : 'Offline'
  }
  return 'Offline'
}

export function PresenceDot({
  online,
  lastSeenAt,
  className,
}: {
  online: boolean
  lastSeenAt?: string | null
  className?: string
}) {
  const label = presenceLabel(online, lastSeenAt ?? null)
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cx('inline-flex items-center justify-center', className)}
            // The dot is decorative; the accessible name lives in the sr-only span.
          >
            <span
              aria-hidden="true"
              className={cx(
                'size-2 rounded-full',
                online ? 'bg-apt-green' : 'border border-apt-text-dim bg-transparent',
              )}
            />
            <span className="sr-only">{label}</span>
          </span>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
