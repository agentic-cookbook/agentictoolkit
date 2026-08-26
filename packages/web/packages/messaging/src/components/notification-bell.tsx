'use client'

// Header notification bell — a ghost icon Button with a numeric unread Badge
// overlaid, toggling a Popover that shows the inbox. Composes the shared
// @agenticdevelopertoolkit/ui primitives (Button, Badge, Popover) so it renders identically to
// the rest of the platform chrome.

import { useState } from 'react'
import { Bell } from 'lucide-react'

import { Badge } from '@agenticdevelopertoolkit/ui/components/badge'
import { Button } from '@agenticdevelopertoolkit/ui/components/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@agenticdevelopertoolkit/ui/components/popover'

import { useUnreadCount } from '../hooks/use-notifications'
import { NotificationInbox } from './notification-inbox'

/** Cap the visible count so the badge never blows out its pill. */
function formatCount(count: number): string {
  return count > 99 ? '99+' : String(count)
}

export function NotificationBell() {
  const { count } = useUnreadCount()
  const [open, setOpen] = useState(false)

  // The count is announced through the button's aria-label (screen readers read it
  // on focus + when it changes); the visual Badge is decorative (aria-hidden).
  const label = count > 0 ? `Notifications, ${count} unread` : 'Notifications'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            className="relative"
          >
            <Bell aria-hidden="true" />
            {count > 0 && (
              <Badge
                variant="error"
                aria-hidden="true"
                className="absolute -right-1 -top-1 min-w-4 justify-center px-1 py-0 leading-none"
              >
                {formatCount(count)}
              </Badge>
            )}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-80 p-0">
        <NotificationInbox className="max-h-[32rem]" />
      </PopoverContent>
    </Popover>
  )
}
