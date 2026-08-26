'use client'

// The unified in-app notification inbox (messaging P5). Composes the shared
// @agenticdevelopertoolkit/ui primitives so it renders identically to the rest of the platform
// chrome, and is mount-agnostic: it fills its container (no fixed width), so it
// works inside the header bell's Popover and as a standalone workspace panel.
// Pass `className="max-h-[…]"` for a bounded popover, or `className="h-full"` to
// fill a sized panel — the internal list is a `flex-1 min-h-0` scroll region.

import { useCallback, useMemo, useState, type ComponentProps } from 'react'
import {
  Archive,
  Check,
  CheckCheck,
  Inbox as InboxIcon,
  ListFilter,
  MoreHorizontal,
  Trash2,
  Undo2,
  X,
} from 'lucide-react'

import { Badge } from '@agenticdevelopertoolkit/ui/components/badge'
import { Button } from '@agenticdevelopertoolkit/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@agenticdevelopertoolkit/ui/components/dropdown-menu'
import { EmptyState } from '@agenticdevelopertoolkit/ui/components/empty-state'
import { Spinner } from '@agenticdevelopertoolkit/ui/components/spinner'
import { Tabs, TabsList, TabsTab } from '@agenticdevelopertoolkit/ui/components/tabs'
import { ErrorText } from '@agenticdevelopertoolkit/ui/components/error-text'

import {
  useInbox,
  type Notification,
  type NotificationStatus,
} from '../hooks/use-notifications'
import { cx, formatRelativeTime } from './util'

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>['variant']>

/**
 * The single source of truth mapping a notification category → its display label
 * and Badge tone. Tones are the shared `apt-*` semantic Badge variants (accent =
 * gold, blue, success = green, orange, neutral). Unknown categories fall back to
 * a prettified label + neutral tone, so a new backend category never renders raw.
 */
const CATEGORY_META: Record<string, { label: string; variant: BadgeVariant }> = {
  admin_announcement: { label: 'Announcement', variant: 'accent' }, // gold
  direct_message: { label: 'Message', variant: 'blue' },
  community_reply: { label: 'Reply', variant: 'success' }, // green
  community_mention: { label: 'Mention', variant: 'orange' },
  account: { label: 'Account', variant: 'neutral' },
  // Projects. `Assigned` borrows the accent tone an announcement uses because it is the
  // one row in this list that is a request rather than news; the other three sit at the
  // weight of the community signals they mirror.
  project_assigned: { label: 'Assigned', variant: 'accent' },
  project_mention: { label: 'Mention', variant: 'orange' },
  project_comment: { label: 'Comment', variant: 'success' },
  project_status: { label: 'Status', variant: 'blue' },
}

/** Categories offered in the multi-select filter, in a stable display order. */
const FILTERABLE_CATEGORIES = Object.keys(CATEGORY_META)

function categoryMeta(category: string): { label: string; variant: BadgeVariant } {
  return (
    CATEGORY_META[category] ?? {
      label: category.replace(/_/g, ' '),
      variant: 'neutral',
    }
  )
}

const STATUS_TABS: Array<{ id: NotificationStatus; label: string }> = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'archived', label: 'Archived' },
  { id: 'trashed', label: 'Trash' },
]

/** Per-status empty-state copy. */
const EMPTY_COPY: Record<NotificationStatus, { title: string; description: string }> = {
  inbox: { title: "You're all caught up", description: 'New notifications will appear here.' },
  archived: { title: 'Nothing archived', description: 'Archived notifications land here.' },
  trashed: { title: 'Trash is empty', description: 'Trashed notifications land here.' },
}

interface RowActions {
  markRead: (id: string) => void
  markUnread: (id: string) => void
  archive: (id: string) => void
  trash: (id: string) => void
}

/** One notification row: unread dot, category badge, timestamp, title, body preview, kebab. */
function NotificationRow({
  item,
  actions,
}: {
  item: Notification
  actions: RowActions
}) {
  const meta = categoryMeta(item.category)
  const relative = formatRelativeTime(item.createdAt)

  return (
    <li className="flex gap-3 px-4 py-3">
      {/* Unread indicator — a dot for sighted users, an sr-only word for AT. */}
      <span className="mt-1.5 flex w-2 shrink-0 justify-center" aria-hidden="true">
        {!item.isRead && <span className="size-2 rounded-full bg-apt-blue" />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Badge variant={meta.variant}>{meta.label}</Badge>
          {relative && (
            <time
              dateTime={item.createdAt}
              title={new Date(item.createdAt).toLocaleString()}
              className="text-xs text-apt-text-dim"
            >
              {relative}
            </time>
          )}
        </div>
        <p
          className={cx(
            'mt-1 truncate text-sm',
            item.isRead ? 'font-normal text-apt-text-muted' : 'font-semibold text-apt-text',
          )}
        >
          {!item.isRead && <span className="sr-only">Unread. </span>}
          {item.title}
        </p>
        {item.body && (
          <p className="mt-0.5 line-clamp-2 text-xs text-apt-text-muted">{item.body}</p>
        )}
      </div>

      <RowMenu item={item} actions={actions} />
    </li>
  )
}

/** The per-row kebab menu — read/unread + archive/trash, context-appropriate. */
function RowMenu({ item, actions }: { item: Notification; actions: RowActions }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-apt-text-muted"
            aria-label="Notification actions"
          />
        }
      >
        <MoreHorizontal aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {item.isRead ? (
          <DropdownMenuItem onSelect={() => actions.markUnread(item.id)}>
            <Undo2 aria-hidden="true" />
            Mark as unread
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => actions.markRead(item.id)}>
            <Check aria-hidden="true" />
            Mark as read
          </DropdownMenuItem>
        )}
        {item.status !== 'archived' && (
          <DropdownMenuItem onSelect={() => actions.archive(item.id)}>
            <Archive aria-hidden="true" />
            Archive
          </DropdownMenuItem>
        )}
        {item.status !== 'trashed' && (
          <DropdownMenuItem onSelect={() => actions.trash(item.id)}>
            <Trash2 aria-hidden="true" />
            Move to trash
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The multi-select category filter — a checkbox DropdownMenu over the known categories. */
function CategoryFilter({
  selected,
  onToggle,
  onClear,
}: {
  selected: string[]
  onToggle: (category: string, next: boolean) => void
  onClear: () => void
}) {
  const count = selected.length
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" aria-label="Filter by category" />}
      >
        <ListFilter aria-hidden="true" />
        Categories
        {count > 0 && (
          <Badge variant="accent" aria-hidden="true" className="ml-1 px-1 py-0">
            {count}
          </Badge>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-48">
        <DropdownMenuLabel>Filter by category</DropdownMenuLabel>
        {FILTERABLE_CATEGORIES.map((category) => (
          <DropdownMenuCheckboxItem
            key={category}
            checked={selected.includes(category)}
            // Keep the menu open so several categories can be toggled at once.
            onSelect={(e) => e.preventDefault()}
            onCheckedChange={(next) => onToggle(category, next)}
          >
            {categoryMeta(category).label}
          </DropdownMenuCheckboxItem>
        ))}
        {count > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onClear}>
              <X aria-hidden="true" />
              Clear filter
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function NotificationInbox({ className }: { className?: string }) {
  const [status, setStatus] = useState<NotificationStatus>('inbox')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [actionError, setActionError] = useState<string | null>(null)

  // Stable order regardless of the order the user toggled chips in, so the query
  // string (and thus the fetch) only changes when the *set* changes.
  const categories = useMemo(
    () => FILTERABLE_CATEGORIES.filter((c) => selectedCategories.includes(c)),
    [selectedCategories],
  )

  const { items, loading, error, markRead, markUnread, archive, trash, readAll } = useInbox({
    status,
    categories,
  })

  // Run a mutation, surfacing any failure in an inline alert (no toast host here).
  const runAction = useCallback(async (fn: () => Promise<void>) => {
    setActionError(null)
    try {
      await fn()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed')
    }
  }, [])

  const rowActions = useMemo<RowActions>(
    () => ({
      markRead: (id) => void runAction(() => markRead(id)),
      markUnread: (id) => void runAction(() => markUnread(id)),
      archive: (id) => void runAction(() => archive(id)),
      trash: (id) => void runAction(() => trash(id)),
    }),
    [runAction, markRead, markUnread, archive, trash],
  )

  const toggleCategory = useCallback((category: string, next: boolean) => {
    setSelectedCategories((prev) =>
      next ? [...prev, category] : prev.filter((c) => c !== category),
    )
  }, [])
  const clearCategories = useCallback(() => setSelectedCategories([]), [])

  const hasUnread = status === 'inbox' && items.some((i) => !i.isRead)
  const filterSummary =
    categories.length === 0
      ? 'Showing all categories'
      : `Filtered to ${categories.length} categor${categories.length === 1 ? 'y' : 'ies'}: ${categories
          .map((c) => categoryMeta(c).label)
          .join(', ')}`

  return (
    <section className={cx('flex min-h-0 flex-col', className)} aria-label="Notifications">
      <header className="flex flex-col gap-3 border-b border-apt-border px-4 pb-3 pt-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-apt-text">Notifications</h2>
          {hasUnread && (
            <Button
              variant="ghost"
              size="xs"
              className="text-apt-text-muted"
              onClick={() => void runAction(() => readAll())}
            >
              <CheckCheck data-icon="inline-start" aria-hidden="true" />
              Mark all read
            </Button>
          )}
        </div>

        <Tabs
          value={status}
          onValueChange={(value) => setStatus(value as NotificationStatus)}
          className="gap-0"
        >
          <TabsList>
            {STATUS_TABS.map((tab) => (
              <TabsTab key={tab.id} value={tab.id}>
                {tab.label}
              </TabsTab>
            ))}
          </TabsList>
        </Tabs>

        <div className="flex items-center justify-between gap-2">
          <CategoryFilter
            selected={selectedCategories}
            onToggle={toggleCategory}
            onClear={clearCategories}
          />
          {categories.length > 0 && (
            <Button
              variant="ghost"
              size="xs"
              className="text-apt-text-muted"
              onClick={clearCategories}
            >
              Clear
            </Button>
          )}
        </div>
        {/* Announce the active filter to assistive tech without visual clutter. */}
        <p role="status" aria-live="polite" className="sr-only">
          {filterSummary}
        </p>
      </header>

      <ErrorText error={actionError} className="border-b border-apt-border px-4 py-2 text-xs" />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center gap-2 px-4 py-6 text-sm text-apt-text-muted">
            <Spinner />
            <span>Loading…</span>
          </div>
        ) : error ? (
          <ErrorText error={error} className="px-4 py-6" />
        ) : items.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<InboxIcon aria-hidden="true" />}
              title={
                categories.length > 0
                  ? 'No notifications match this filter'
                  : EMPTY_COPY[status].title
              }
              description={
                categories.length > 0
                  ? 'Try clearing the category filter.'
                  : EMPTY_COPY[status].description
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-apt-border">
            {items.map((item) => (
              <NotificationRow key={item.id} item={item} actions={rowActions} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
