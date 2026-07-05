"use client"

import type { ReactNode } from "react"

import { cn } from "../lib/utils"
import { Badge } from "../components/badge"
import { EmptyState } from "../components/empty-state"
import { ButtonBar } from "./button-bar"
import { TopicDetail, type TopicDetailItem } from "./topic-detail"

export interface EditorSectionItem {
  id: string
  label: string
  sublabel?: string
  /** 16px leading icon for the row (rows without one get the rail's neutral ring). */
  icon?: ReactNode
  /** Shows a ⚠ at the row's right edge (e.g. "needs configuration"). */
  warn?: boolean
  warnTitle?: string
  /** When set, the warning renders as a ⚠ N count badge instead of a bare ⚠
   *  (e.g. "5 project sites not yet connected"). Only shown when `warn` is true. */
  warnCount?: number
}

// Master/detail editor shell: the standard editing ButtonBar (gold title +
// New / Delete / Cancel / Save), the standard collapsible topic rail, and a
// detail pane that shows `children` while editing or the shared EmptyState
// placeholder otherwise. A pure assembly of ButtonBar + TopicDetail +
// EmptyState — it owns no visual grammar of its own.
export function EditorSection({
  title,
  titleBadge,
  createLabel,
  items,
  selectedId,
  onSelect,
  onNew,
  onDelete,
  onCancel,
  onSave,
  dirty,
  busy = false,
  canDelete,
  error,
  emptyList,
  emptyDetail,
  listHeader,
  railWidth,
  children,
  className,
}: {
  title: ReactNode
  /** Optional accessory rendered next to the title (e.g. a count badge). */
  titleBadge?: ReactNode
  createLabel: string
  items: EditorSectionItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete?: () => void
  onCancel: () => void
  onSave: () => void
  dirty: boolean
  busy?: boolean
  /** Whether the current selection can be deleted. Defaults to "anything selected";
      pass `false` for an unsaved/new draft so Delete isn't offered on a non-row. */
  canDelete?: boolean
  /** A mutation error to surface under the toolbar (red line). */
  error?: ReactNode
  emptyList?: ReactNode
  emptyDetail: ReactNode
  /** Rendered in the rail's leading slot (e.g. filters); hidden while collapsed. */
  listHeader?: ReactNode
  /** The rail's natural width in px (TopicDetail's railWidth). Widen for rails
   *  whose rows are long identifiers (URLs). */
  railWidth?: number
  children: ReactNode
  className?: string
}) {
  const editing = selectedId !== null
  const deletable = canDelete ?? editing
  const railItems: TopicDetailItem[] = items.map((item) => ({
    id: item.id,
    label: item.label,
    sublabel: item.sublabel,
    icon: item.icon,
    trailing: item.warn ? (
      item.warnCount != null ? (
        <Badge variant="accent" title={item.warnTitle} aria-label={item.warnTitle}>
          ⚠ {item.warnCount}
        </Badge>
      ) : (
        <span title={item.warnTitle} aria-label={item.warnTitle} className="text-xs text-apt-gold">
          ⚠
        </span>
      )
    ) : undefined,
  }))
  return (
    <div className={cn("flex min-h-0 flex-1 flex-col", className)}>
      <ButtonBar
        leading={
          <span className="mr-1.5 flex items-center gap-1.5 font-mono text-[13px] text-apt-gold">
            {title}
            {titleBadge}
          </span>
        }
        actions={{
          onCreate: onNew,
          createLabel,
          onCancel,
          canCancel: editing,
          onSave,
          canSave: editing && dirty,
          saving: busy,
          onDelete,
          canDelete: deletable && !busy,
        }}
        showDelete={!!onDelete}
      />
      {error && (
        <div className="shrink-0 border-b border-apt-border px-3.5 py-1.5 font-mono text-xs text-apt-red">
          {error}
        </div>
      )}
      <TopicDetail
        items={railItems}
        selectedId={selectedId}
        onSelect={onSelect}
        emptyLabel={emptyList ?? "Nothing here yet."}
        railSlot={listHeader ? (collapsed) => (collapsed ? null : listHeader) : undefined}
        railWidth={railWidth}
        panePadding={false}
      >
        {editing ? (
          children
        ) : (
          <EmptyState title={emptyDetail} className="m-3.5 min-h-[200px] flex-1" />
        )}
      </TopicDetail>
    </div>
  )
}
