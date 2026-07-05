"use client"

import { Fragment, type ReactNode } from "react"

import { PopupMenu, type PopupMenuItem } from "./popup-menu"
import { ResourceCard } from "./resource-card"
import { SectionHeader } from "./section-header"
import { TopicDetail, type TopicDetailItem } from "./topic-detail"

// Faithful port of the adh.com/home focused view (ResourceTab + ResourceLanding):
//
//   [popup menu]    │  [section header: the focused item]
//   [topic items]   │  [the active topic's content]
//   [─ divider ─]   │
//   [Settings]      │
//
// Nothing focused (popup = "All") → the topics dim, the gold bar moves onto the
// popup row, and the detail side shows the all-items CARD VIEW; clicking a card
// focuses that item. Composed ENTIRELY from existing blocks — PopupMenu,
// TopicDetail, SectionHeader, ResourceCard. Anything inside the focused detail
// pane (e.g. a ButtonBar) is the consumer's content — an implementation detail
// of the details pane, not of this frame.

export interface FocusedTopicDetailItem extends PopupMenuItem {
  /** Mono identifier line on the all-items card (e.g. reverse-domain id). */
  sublabel?: string
  /** Card body description. */
  description?: ReactNode
  /** Card meta row (mono-dim chips with icons). */
  meta?: ReactNode
}

export function FocusedTopicDetail({
  items,
  focusedId,
  onFocus,
  topics,
  activeTopicId,
  onTopicSelect,
  title,
  nameSuffix,
  help,
  allTitle = "All items",
  allHelp,
  allEmptyLabel = "Nothing here yet.",
  onNew,
  newLabel,
  popupAriaLabel,
  children,
}: {
  /** The focusable items — the popup's entries and the all-view's cards. */
  items: FocusedTopicDetailItem[]
  /** The focused item id, or null = nothing focused (the "All" card view). */
  focusedId: string | null
  onFocus: (id: string | null) => void
  /** The rail topics scoped to the focused item (dimmed while unfocused). */
  topics: TopicDetailItem[]
  activeTopicId: string | null
  onTopicSelect: (id: string) => void
  /** Explicit section header for the focused state. Usually omit this and pass
   *  `nameSuffix` instead — the header is then derived as
   *  "{topic label} ({item label} {nameSuffix})", the hub's titleFor. */
  title?: ReactNode
  /** Derives the focused header, e.g. "Ecosystem" → "Applications (Temporal Ecosystem)". */
  nameSuffix?: string
  help?: ReactNode
  /** Section header for the all-items card view, e.g. "All ecosystems". */
  allTitle?: string
  allHelp?: ReactNode
  allEmptyLabel?: string
  /** Optional "New …" entry in the popup. */
  onNew?: () => void
  newLabel?: string
  popupAriaLabel: string
  /** The active topic's content when focused (a ButtonBar etc. lives in here). */
  children: ReactNode
}) {
  // A stale/unknown focusedId (e.g. the focused item was deleted) falls back to
  // the all-items view rather than an inconsistent half-focused frame — the
  // hub's ResourceTab does the same via its knownId check.
  const focusedItem = focusedId != null ? items.find((i) => i.id === focusedId) : undefined
  const focused = focusedItem !== undefined
  // The hub's titleFor: "{topic label} ({item label} {suffix})". An explicit
  // `title` overrides; without either, the focused header row is omitted.
  const topicLabel = topics.find((t) => t.id === activeTopicId)?.label
  const derivedTitle =
    focusedItem && nameSuffix && topicLabel
      ? `${topicLabel} (${focusedItem.label} ${nameSuffix})`
      : undefined
  const focusedTitle = title ?? derivedTitle
  return (
    <TopicDetail
      items={topics.map((t) => ({ ...t, disabled: t.disabled || !focused }))}
      selectedId={focused ? activeTopicId : null}
      onSelect={onTopicSelect}
      railSlot={
        <PopupMenu
          items={items}
          selectedId={focusedId}
          onSelect={onFocus}
          onNew={onNew}
          newLabel={newLabel}
          ariaLabel={popupAriaLabel}
        />
      }
      railSlotActive={!focused}
      // The pane is edge-to-edge (hub's .settings-content carries no inset);
      // each row below brings its own, so consumer content like a ButtonBar
      // spans the full pane without negative-margin hacks.
      panePadding={false}
    >
      {focused ? (
        // Keyed by the focused item so its pane content REMOUNTS on a focus
        // switch (fresh form/draft state) — the hub keys pane content by
        // scopedId for the same reason.
        <Fragment key={focusedId}>
          {focusedTitle && (
            <div className="px-6 pt-4 pb-2">
              <SectionHeader title={focusedTitle} help={help} />
            </div>
          )}
          {children}
        </Fragment>
      ) : (
        <>
          <div className="px-6 pt-4 pb-2">
            <SectionHeader title={allTitle} help={allHelp} />
          </div>
          {items.length === 0 ? (
            <p className="px-6 pb-4 text-sm text-apt-text-muted">{allEmptyLabel}</p>
          ) : (
            <div className="grid gap-4 px-6 pt-2 pb-6 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <ResourceCard
                  key={item.id}
                  title={item.label}
                  identifier={item.sublabel}
                  description={item.description}
                  meta={item.meta}
                  onClick={() => onFocus(item.id)}
                  // Hub's all-items cards hover GOLD (ResourceLanding's
                  // group-hover:border-apt-gold/60), not the card default.
                  className="hover:border-apt-gold/60 hover:bg-apt-surface"
                />
              ))}
            </div>
          )}
        </>
      )}
    </TopicDetail>
  )
}
