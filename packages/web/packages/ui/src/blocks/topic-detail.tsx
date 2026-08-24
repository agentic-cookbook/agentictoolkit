"use client"

import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react"

import { ChevronRight, Circle, Loader2, Plus, Trash2, X } from "lucide-react"

import { AlertModal } from "../components/alert-modal"
import { CollapseToggle } from "../components/collapse-toggle"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../components/tooltip"
import { cn } from "../lib/utils"

// Faithful port of the adh.com/home topic rail, originally translated 1:1 from
// hub/src/components/settings/SettingsLayout.tsx + its settings.css (.settings-layout /
// .settings-nav / .settings-nav-item / .settings-nav-divider / .settings-content) into
// utilities with the apt-* tokens (--accent → apt-gold, --text → apt-text, --border →
// apt-border …). That original is GONE — the hub now renders this, so this file is the
// source of truth and there is nothing left to stay faithful to.

export interface TopicDetailItem {
  id: string
  label: string
  /** Small dim second line (e.g. a reverse-domain identifier). */
  sublabel?: string
  /** Render `sublabel` INLINE after the label on ONE line (dim), instead of stacked on a
   *  second line — for dense entity lists (sites / groups / platforms) where a single row
   *  per item is wanted. The label keeps layout priority (grows + truncates first); the
   *  sublabel shrinks + truncates after it. No effect in the icon-only (collapsed/covered)
   *  strips, which hide the label entirely. */
  inlineSublabel?: boolean
  /** A few lines of the row's CONTENT, under the label — a note's body, a message's text. Dim,
   *  clamped to {@link previewLines}, and shown only where the label is (never in the collapsed /
   *  covered icon strips). Opt-in: a list that sets no `preview` renders exactly as it did. */
  preview?: string
  /** How many lines of {@link preview} to show, clamped to 0-4 (default 1). ZERO renders no
   *  preview at all, so a list whose row height is a user preference can keep passing `preview`
   *  and let this one number carry the setting — including its "off" position. */
  previewLines?: number
  /** What this topic is for — one or two sentences. **This component renders it nowhere.** It fed
   *  the card grid that a level could opt into for its unselected frontier, and that opt-in is gone
   *  (docs/ui/fleet-ui-audit.md §1.5 — the unselected frontier is the select nudge and nothing
   *  else), so setting it changes no pixel here. It survives because hosts carry the same row shape
   *  into surfaces that DO show a blurb (a selected topic's `EmptyState`); to explain a LIST, use
   *  the level's `overviewHelp`, which is the copy the nudge renders. */
  description?: string
  /** 16px leading icon; tints with the label (currentColor). The rail is always
   *  collapsible, so every row is guaranteed an icon — a neutral ring fills in
   *  when omitted — so the collapsed icon-only strip never shows a blank slot. */
  icon?: ReactNode
  /** What choosing this row leads to — another topic LIST, or the DETAIL (a FINAL CHOICE).
   *  Overrides the level's `leadsTo` default for this one row; unset on both means `"detail"`.
   *  Declared, not inferred: the cascading view's detail hold and final-choice auto-collapse
   *  (must-hold-the-detail-until-the-final-choice) key off it at click time. `"detail"` is the
   *  fail-safe — an undeclared row swaps the pane immediately, it can never hold it hostage. */
  leadsTo?: "list" | "detail"
  /** Render a separator row after this item (hub: before Settings). */
  dividerAfter?: boolean
  /** Render a flexible spacer after this item, pushing every following item to the
   *  rail's bottom edge (e.g. a bottom-pinned Settings). Applies in the collapsed /
   *  covered icon strips too. */
  spacerAfter?: boolean
  /** Dimmed + non-clickable (hub: scoped topics while "All" is active). */
  disabled?: boolean
  /** Trailing accessory pinned to the row's right edge (e.g. a warn Badge or a
   *  count). Hidden in icon-only modes (collapsed / covered), like the label. */
  trailing?: ReactNode
  /** Enable a right-justified trash button on this row, revealed on hover (and keyboard focus).
   *  Clicking it opens a confirmation dialog; ON CONFIRM this runs (may be async — the dialog shows
   *  a spinner until it settles). Only rendered in the expanded list, never the collapsed/covered
   *  icon strips. In the hierarchical stack the selection connector line breaks around the button. */
  onDelete?: () => void | Promise<void>
  /** Accessible name for the trash button and the confirm dialog's subject. Defaults to `label`. */
  deleteLabel?: string
  /** Confirmation body copy. Defaults to a generic "can't be undone" warning. */
  deleteConfirm?: ReactNode
  /** Marks this row as holding a field that is blocking some other action elsewhere in the view
   *  (e.g. a disabled Save whose blocking field lives on this topic's pane). The row gets an amber
   *  dot on its icon — visible in the expanded list AND the collapsed / covered icon strips, which
   *  is where a user hunting for a greyed-out Save most needs it — plus a screen-reader-only
   *  "needs attention" so the marker is not colour-only. It also carries `data-blocked="true"`
   *  for callers and tests that need to find the row programmatically. */
  blocked?: boolean
}

/** A leading rail row rendered ABOVE the topics (e.g. a custom list header, or a PopupMenu control in
 *  FocusedTopicDetail). A function form receives the rail's collapsed state so it can shrink/hide when
 *  undisclosed. Rendered only when provided — an absent slot reserves NO space (the first topic sits at
 *  the top padding). This is distinct from the header `+` create affordance (`onNew`), which the
 *  hierarchical stack uses for its "New …" button. */
export type RailSlot = ReactNode | ((collapsed: boolean) => ReactNode)

// One shared element reference for icon-less rows — stable across renders so
// React's reconciler skips it. The rail always collapses to an icon-only strip,
// so every row needs a guaranteed leading icon; this fills in for rows that omit
// one. `||` (not `??`) also fills in for a `false` node from `cond && <Icon/>`.
const FALLBACK_ICON = <Circle size={16} aria-hidden />

// The clamp for each supported preview height. A lookup and not `line-clamp-${n}`: Tailwind reads
// the source text, so a class it never sees written out is a class it never generates.
const PREVIEW_CLAMP: Record<number, string> = {
  1: "line-clamp-1",
  2: "line-clamp-2",
  3: "line-clamp-3",
  4: "line-clamp-4",
}

// The rail's natural (full) width and the collapsed icon-strip width. Dragging the rail's
// trailing border narrower than a third of FULL snaps it to undisclosed; dragging it past
// FULL snaps it back to full.
// The rail's natural (full) width and the collapsed icon-strip width. Exported so
// HierarchicalTopicDetail's fit math uses the SAME contract (one authoritative home).
export const FULL_RAIL = 240
export const COLLAPSED_RAIL = 48

// How long a pointer (or the keyboard focus) must rest on a row before it counts as intent.
// Short enough to be invisible ahead of a click, long enough that sweeping down a list warms
// nothing — a per-row fire would cost MORE requests than the caching saves.
const PREFETCH_DWELL_MS = 100

function TopicList({
  items,
  selectedId,
  onSelect,
  emptyLabel,
  railSlot,
  railSlotActive,
  collapsed,
  covered = false,
  isRoot = false,
  selectionStyle = "bar",
  rowDisclosure = false,
  hoverBar = true,
  hideItemIcons = false,
  onPrefetch,
}: {
  items: TopicDetailItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  emptyLabel: ReactNode
  /** Optional leading row above the topics (a custom header / control). Rendered only when provided. */
  railSlot?: RailSlot
  /** Move the gold selection bar onto the rail slot (nothing in the list selected). */
  railSlotActive?: boolean
  /** Currently collapsed → icon-only rows; labels move to title/aria-label. */
  collapsed?: boolean
  /** This is the ROOT (outermost) list: its selected row shows a leading gold dash (marker style). */
  isRoot?: boolean
  /** Covered (peeking under a child in the "covered" style): render a clean LEFT-aligned icon strip
   *  (icon only, so the icon stays inside the ~40px peek). The whole list is revealed on hover by the
   *  covered stack (it re-layers the real rail full-width above its neighbours), so there is no
   *  per-row popover here. */
  covered?: boolean
  /** How a selected row is marked: `"bar"` (default) is the classic gold left bar — for standalone
   *  TopicDetail and the minimized stack. `"marker"` drops the bar for the dash (root) + the
   *  parent→child connector line (drawn by the covered stack's overlay). */
  selectionStyle?: "bar" | "marker"
  /** Whether hovering an unselected row previews the left bar. Default true (every existing rail).
   *  `false` removes it: the cascading menus want no hover bar — there, hover is conveyed by the row
   *  UN-DIMMING, and a second white bar on top of that just reads as noise. */
  hoverBar?: boolean
  /** Drop the LEADING icon from every row in this list. Expanded list only: the collapsed
   *  and covered strips are icon-only — the icon is the entire row there — so this is
   *  ignored while `iconOnly` is true. For lists whose rows have no identity icon worth
   *  showing (research's documents), where the fallback `Circle` was noise. */
  hideItemIcons?: boolean
  /** Trailing chevron on every selectable row, signalling that picking it discloses another pane —
   *  the narrow (nav-stack) layout's only affordance for that, since it has no peeking sibling column
   *  to hint at what a tap pushes in. Hidden on a `disabled` row (it isn't going anywhere) and in the
   *  icon-only layouts (no room, and the covered/minimized styles already show that via layering). */
  rowDisclosure?: boolean
  /** Warm this row before it is clicked. Called with the row's id once the pointer or the
   *  keyboard focus has rested on it for {@link PREFETCH_DWELL_MS}. Fire-and-forget: the row
   *  never waits on it and never shows anything for it. Omit for no prefetching at all. */
  onPrefetch?: (id: string) => void
}) {
  // Icon-only layouts share the no-label row: `collapsed` CENTRES the icon (minimized icon strip);
  // `covered` keeps it LEFT-aligned so the icon stays inside the peek.
  const iconOnly = !!collapsed || covered

  // Row delete: a row's hover-revealed trash button opens this confirm; ON CONFIRM the item's
  // (possibly async) onDelete runs, with a spinner shown until it settles. Reuses the shared
  // AlertModal so the prompt matches every other destructive confirm on the platform.
  const [pendingDelete, setPendingDelete] = useState<TopicDetailItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  // ONE timer for the whole list: intent moves from row to row, and a per-row timer would let a
  // sweep leave several armed at once.
  const dwellRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const disarmPrefetch = useCallback(() => {
    if (dwellRef.current) {
      clearTimeout(dwellRef.current)
      dwellRef.current = null
    }
  }, [])
  const armPrefetch = useCallback(
    (id: string) => {
      if (!onPrefetch) return
      if (dwellRef.current) clearTimeout(dwellRef.current)
      dwellRef.current = setTimeout(() => {
        dwellRef.current = null
        onPrefetch(id)
      }, PREFETCH_DWELL_MS)
    },
    [onPrefetch],
  )
  useEffect(() => disarmPrefetch, [disarmPrefetch])
  // Retain the last target through the dialog's close animation so its title doesn't blank out.
  const lastDeleteRef = useRef<TopicDetailItem | null>(null)
  if (pendingDelete) lastDeleteRef.current = pendingDelete
  const deleteTarget = pendingDelete ?? lastDeleteRef.current
  const runDelete = async () => {
    if (!pendingDelete?.onDelete) {
      setPendingDelete(null)
      return
    }
    try {
      setDeleting(true)
      await pendingDelete.onDelete()
      setPendingDelete(null)
    } catch {
      // Leave the dialog open (no longer busy) so the user can retry or cancel; the consumer's
      // onDelete owns surfacing the failure.
    } finally {
      setDeleting(false)
    }
  }

  const itemButton = (item: TopicDetailItem, active: boolean) => {
    const hideLabel = iconOnly
    const centered = !!collapsed
    // Never in the icon-only strips: there the icon IS the row.
    const hideIcon = hideItemIcons && !iconOnly
    // Every row is guaranteed a leading icon so the icon-only strip never shows a blank slot.
    const icon = item.icon || FALLBACK_ICON
    // A deletable expanded row reserves extra right padding so the label never runs under the
    // hover-revealed trash button (and the rail width accounts for it).
    const deletable = !!item.onDelete && !hideLabel
    // The preview, resolved to the one thing the row renders: its text and its clamp. `previewLines`
    // is clamped rather than trusted — it comes from a user setting, and a number outside 0-4 has no
    // class to render, which would silently drop the clamp and print the whole note into the rail.
    const previewLines = Math.max(0, Math.min(4, Math.trunc(item.previewLines ?? 1)))
    const previewText = item.preview?.trim() ?? ""
    const preview =
      previewLines > 0 && previewText !== ""
        ? { text: previewText, clamp: PREVIEW_CLAMP[previewLines] }
        : null
    return (
      <button
        type="button"
        data-htd-row
        data-blocked={item.blocked ? "true" : undefined}
        disabled={item.disabled}
        onClick={() => {
          // Covered lists pure-SELECT: a click only CHANGES the selection — it never toggles/unselects,
          // and is a no-op if this row is already selected. Selecting clears the descendant lists and
          // shows the chosen item's detail (onSelect's job). Uncovered lists keep the package's toggle
          // (re-click a selected row to deselect).
          if (covered && active) return
          onSelect(item.id)
        }}
        // Never ARM on the row that is already open: a prefetch is a guess about where the user is
        // going, and this item's read has already happened. Warming it again re-reads it behind the
        // pane the user is looking at, and the read spins this very list. The DISARM handlers stay
        // unconditional — they only ever cancel a timer another row armed.
        onPointerEnter={onPrefetch && !active ? () => armPrefetch(item.id) : undefined}
        onPointerLeave={onPrefetch ? disarmPrefetch : undefined}
        onFocus={onPrefetch && !active ? () => armPrefetch(item.id) : undefined}
        onBlur={onPrefetch ? disarmPrefetch : undefined}
        aria-current={active ? "true" : undefined}
        // Icon-only rows have no visible text → carry the label as the accessible name, plus the
        // blocked state the amber dot conveys visually (the sr-only span below can't do it here —
        // aria-label replaces the element's content for AT).
        aria-label={
          hideLabel ? (item.blocked ? `${item.label}, needs attention` : item.label) : undefined
        }
        className={cn(
          // .settings-nav-item: mono, 0.8rem, tracking 0.02em.
          "relative flex w-full border-l-2 border-transparent bg-transparent transition-colors",
          // A row that is one or two lines tall centres its icon against them; a row carrying a
          // preview is mostly preview, so centring would float the icon down beside the body text
          // instead of beside the name it labels.
          preview ? "items-start" : "items-center",
          "[&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
          centered
            ? "justify-center py-1.5"
            : cn(
                // `pl-2` is the leading gap from the list's edge to the row's ICON — half the
                // original inset, so rows sit closer to the edge and a covered list's 40px peek
                // shows more of its icon. The root's selection dash below is sized to fit inside it.
                "gap-2 pt-1 pb-0.5 pl-2 text-left font-mono text-[0.8rem] tracking-[0.02em]",
                deletable ? "pr-9" : "pr-3",
              ),
          item.disabled
            ? "cursor-default text-apt-text-dim"
            : active
              ? // "marker" selection (the hierarchical covered stack): no gold bar — selection shows as
                // the leading dash (root) + the connector line from the parent (drawn by the stack).
                // "bar" selection (standalone TopicDetail, the minimized stack): the classic gold left
                // bar, since those have no connector overlay to convey selection.
                selectionStyle === "marker"
                ? "text-apt-gold"
                : "border-l-apt-gold text-apt-gold"
              : cn("cursor-pointer text-apt-text", hoverBar && "hover:border-l-apt-text"),
        )}
      >
        {/* Root list, marker style: the selected row is marked by a FULL-HEIGHT vertical bar flush
            with the row's left edge (Mike — replaces the old horizontal dash that sat in the `pl-2`
            leading gap). Drawn as an element rather than the row's `border-l` because the border is
            the hover affordance's channel and a marker rail must not depend on that. */}
        {active && isRoot && !centered && selectionStyle === "marker" && (
          // `-left-0.5`, not `left-0`: the row carries a 2px transparent `border-l` (the hover
          // affordance's channel), and an absolute child resolves against the PADDING box — so
          // `left-0` would sit 2px inside the row's real edge. The negative offset backs it onto the
          // border box, flush with the column edge.
          <span aria-hidden className="absolute inset-y-0 -left-0.5 w-0.5 bg-apt-gold" />
        )}
        {/* Decorative: the label (text or aria-label) is the name, so the icon is hidden from AT. */}
        {!hideIcon && (
          <span aria-hidden data-htd-icon className="relative flex shrink-0">
            {icon}
            {/* The blocked marker rides the ICON rather than the trailing accessory slot, because
                the accessory is dropped in the collapsed / covered icon strips — exactly the modes
                where the user can't read the label and most needs to see WHICH topic is holding
                Save down. The ring punches it out of whatever the row sits on. */}
            {item.blocked && (
              <span
                data-htd-blocked
                className="absolute -top-0.5 -right-1 h-1.5 w-1.5 rounded-full bg-apt-orange ring-2 ring-apt-nav"
              />
            )}
          </span>
        )}
        {/* No icon to ride, so the marker stands on its own. `hideItemIcons` is about
            IDENTITY — a level saying its rows need no leading glyph to tell them apart — and
            `blocked` is STATE, which no level asked to hide. Dropping the dot with the icon
            left the sr-only announcement below with nothing visible behind it: a row that
            reads "needs attention" and looks exactly like its neighbours. */}
        {hideIcon && item.blocked && (
          <span
            aria-hidden
            data-htd-blocked
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-apt-orange"
          />
        )}
        {!hideLabel && (
          <span
            data-htd-label
            className={cn("min-w-0", item.inlineSublabel && item.sublabel && "flex-1")}
          >
            {item.inlineSublabel && item.sublabel ? (
              // Single-line row: label + dim sublabel share one line. The label grows and
              // truncates first (it's the identifier that matters); the sublabel shrinks and
              // truncates after it so a long secondary string can't crowd the label out.
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <span className="min-w-0 shrink truncate text-[0.7rem] text-apt-text-dim">
                  {item.sublabel}
                </span>
              </span>
            ) : (
              <>
                <span className="block truncate">{item.label}</span>
                {item.sublabel && (
                  <span className="block truncate text-[0.7rem] text-apt-text-dim">
                    {item.sublabel}
                  </span>
                )}
              </>
            )}
            {/* The content preview sits under whichever headline shape the row uses, so a list can
                opt into it without also giving up its inline sublabel. `whitespace-pre-line` keeps
                the source's own line breaks — a note previewed as one run-on paragraph reads
                nothing like the note. */}
            {preview && (
              <span
                data-htd-preview
                className={cn(
                  "mt-0.5 block whitespace-pre-line text-[0.7rem] leading-snug text-apt-text-dim",
                  preview.clamp,
                )}
              >
                {preview.text}
              </span>
            )}
          </span>
        )}
        {/* Colour alone is not a signal. The dot lives inside the aria-hidden icon, so the row's
            accessible name carries the state instead — appended AFTER the label here (an
            accessible name is content order), and folded into `aria-label` when the label is
            hidden, since aria-label REPLACES the content and would silence this span.

            Gated on !hideLabel but NOT on hideIcon, and that is now correct: a level setting
            hideItemIcons still draws the standalone dot above, so this announcement always has
            a visible counterpart. (It used to have none — the dot was nested inside the icon
            span, so hideItemIcons hid state along with identity.) */}
        {item.blocked && !hideLabel && <span className="sr-only">, needs attention</span>}
        {!hideLabel && (item.trailing || rowDisclosure) && (
          <span className="ml-auto flex shrink-0 items-center gap-1 pl-1.5">
            {item.trailing}
            {rowDisclosure && !item.disabled && (
              <ChevronRight size={14} aria-hidden className="shrink-0 text-apt-text-dim" />
            )}
          </span>
        )}
      </button>
    )
  }

  return (
    <TooltipProvider>
      {/* min-h-full lets a `spacerAfter` flex spacer push trailing items (e.g. a
          bottom-pinned Settings) to the rail's bottom when the list is shorter than it. */}
      <ul className="m-0 flex min-h-full list-none flex-col p-0">
        {/* Optional leading rail slot (a custom header / control). Rendered ONLY when a railSlot is
            supplied — an absent slot reserves no space, so the first topic sits at the list's top
            padding. Carries the gold selection bar when nothing is focused (railSlotActive). */}
        {railSlot !== undefined && (
          <li
            className={cn(
              "flex min-h-[2.15rem] items-center border-l-2 border-transparent",
              collapsed && "justify-center",
              railSlotActive && "border-l-apt-gold",
            )}
          >
            {typeof railSlot === "function" ? railSlot(!!collapsed) : railSlot}
          </li>
        )}
        {items.length === 0 && (
          <li>
            <p
              className={cn(
                "font-mono text-apt-text-dim",
                collapsed ? "px-1 py-2 text-center text-[0.7rem]" : "px-2 py-2 text-[0.8rem]",
              )}
            >
              {emptyLabel}
            </p>
          </li>
        )}
        {items.map((item) => {
          const active = item.id === selectedId
          const button = itemButton(item, active)
          const deletable = !!item.onDelete && !iconOnly
          return (
            <Fragment key={item.id}>
              <li>
                {collapsed ? (
                  // Collapsed to an icon-only strip: the row's label is no longer visible, so a
                  // hover/focus tooltip names it (replaces the native title — themed, with a delay).
                  <Tooltip>
                    <TooltipTrigger render={button} />
                    <TooltipContent side="right" arrow={false} className="max-w-none whitespace-nowrap">
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                ) : deletable ? (
                  // The row and its hover-revealed trash render as SIBLINGS (a button cannot nest in
                  // the row button). The trash carries `data-htd-delete` so the hierarchical stack's
                  // connector overlay breaks the selection line around it (a computed gap — the
                  // overlay paints above the rail, so occlusion is not possible).
                  <div className="group/htd-row relative">
                    {button}
                    <button
                      type="button"
                      data-htd-delete
                      aria-label={`Delete ${item.deleteLabel ?? item.label}`}
                      title={`Delete ${item.deleteLabel ?? item.label}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setPendingDelete(item)
                      }}
                      className={cn(
                        "absolute top-1/2 right-[3px] z-10 flex size-[19px] -translate-y-1/2 items-center justify-center rounded",
                        "bg-apt-nav text-apt-text-dim opacity-0 outline-none transition-opacity",
                        "hover:text-apt-red focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-apt-red/40 group-hover/htd-row:opacity-100",
                      )}
                    >
                      <Trash2 size={14} aria-hidden />
                    </button>
                  </div>
                ) : (
                  button
                )}
              </li>
              {item.dividerAfter && (
                <li
                  role="separator"
                  className={cn("my-1 h-px bg-apt-border", collapsed ? "mx-2" : "mx-3")}
                />
              )}
              {item.spacerAfter && <li aria-hidden className="min-h-4 flex-1" />}
            </Fragment>
          )
        })}
      </ul>
      {/* One confirm dialog per list; the target row is captured on trash-click. Destructive =
          red action, keyboard shortcuts off, initial focus on Cancel — so a delete is never a
          one-keystroke accident. `busy` shows a spinner and blocks dismissal during an async delete. */}
      <AlertModal
        open={pendingDelete != null}
        destructive
        title={`Delete ${deleteTarget?.deleteLabel ?? deleteTarget?.label ?? ""}?`}
        description={deleteTarget?.deleteConfirm ?? "This action can't be undone."}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        busy={deleting}
        onConfirm={runDelete}
        onCancel={() => {
          if (!deleting) setPendingDelete(null)
        }}
      />
    </TooltipProvider>
  )
}

/**
 * One topic-list column: the darker `.settings-nav` aside with the disclosure toggle,
 * the scrollable list, and a trailing-border drag handle. Width is owned by the PARENT
 * (a CSS grid column), so this is reused as-is both as `TopicDetail`'s single rail and as
 * one of the flat sibling columns in `HierarchicalTopicDetail`. The drag handle measures
 * relative to this column's own left edge and reports a raw width up via `onResize`; the
 * parent clamps/snaps and decides collapse.
 */
export function TopicRail({
  items,
  selectedId,
  onSelect,
  emptyLabel,
  railSlot,
  railSlotActive,
  onNew,
  newLabel,
  newActive,
  titleActions,
  collapsed,
  onToggle,
  onResize,
  onResizeStart,
  onResizeEnd,
  footer,
  backSlot,
  leftControl,
  coveredShadow = false,
  showToggle = true,
  title,
  busy = false,
  railLabel,
  covered = false,
  isRoot = false,
  selectionStyle = "bar",
  headerSlot,
  className,
  rowDisclosure = false,
  onClose,
  closeLabel,
  denseBottom = false,
  hoverBar = true,
  hideItemIcons = false,
  onPrefetch,
}: {
  items: TopicDetailItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  emptyLabel: ReactNode
  /** Optional leading row above the topics (a custom header / control). Rendered only when provided. */
  railSlot?: RailSlot
  /** Move the gold selection bar onto the rail slot (nothing in the list selected). */
  railSlotActive?: boolean
  /** Create affordance: when set, a right-justified `+` button in the list header fires it. */
  onNew?: () => void
  /** Accessible name + tooltip for the `+` (e.g. "New Persona"). Defaults to "New". */
  newLabel?: string
  /** Tint the `+` gold to signal an in-progress create (nothing selected in the list). */
  newActive?: boolean
  /** Extra right-justified controls in the TITLE row, just ahead of the `+` (e.g. an
   *  Auto Configure action). Only rendered with a `title`d, un-collapsed header. */
  titleActions?: ReactNode
  collapsed: boolean
  /** The click event is forwarded so the hierarchical stack can read its modifier keys (⌘/Ctrl-click
   *  = toggle every list). Callers that don't need it take no argument. */
  onToggle: (e: ReactMouseEvent<HTMLButtonElement>) => void
  /** Drag of the trailing border reports the column's new pixel width (raw — the parent
   *  clamps to FULL and snaps to collapsed below a third). Omit to hide the drag
   *  handle (fixed-width rails like the theme editor's property columns). */
  onResize?: (widthPx: number) => void
  onResizeStart?: () => void
  onResizeEnd?: () => void
  /** Pinned below the list (border-t) — e.g. a "New…" affordance at the rail's foot. */
  footer?: ReactNode
  /** Optional leading affordance pinned top-left (e.g. a drill-down "Back" button). */
  backSlot?: ReactNode
  /** Optional control pinned top-left of THIS rail (the "covered" style's `«`/`»` cover
   *  toggle, which lives on the child rail rather than its parent). Renders in place of the
   *  top strip's contents; mutually used with `showToggle=false` to drop the desktop collapse
   *  toggle the covered style doesn't use. */
  leftControl?: ReactNode
  /** Cast a subtle LEFT drop-shadow on this rail (the "covered" style uses it on a child whose
   *  parent is covered, so the stack reads as physically layered). Default off. */
  coveredShadow?: boolean
  /** Extra classes on the rail root. The rail sizes to its ROWS by default, which is right in a grid
   *  cell (the hierarchical stack's columns stretch it) and wrong in a flex pane that IS the whole
   *  screen — there it must be told to fill (`flex-1`), or the page shows through under the last row.
   *  Also the seam for dropping the trailing border when the rail spans the full width. */
  className?: string
  /** Show the desktop collapse toggle (the minimized style's `«` icon-strip toggle). Default
   *  true; the covered style passes false and supplies its own `leftControl` instead. */
  showToggle?: boolean
  /** A left-aligned heading naming the list (e.g. "Workspaces"), with a divider beneath. The control
   *  slot (covered `«`/`»` or a Back) sits where item ICONS start and the title where item LABELS
   *  start, so every titled list reserves the same header height and rows align vertically across
   *  lists. Omit (standalone TopicDetail) to keep the bare control strip with no header/divider. */
  title?: string
  /** A read is in flight for this list — its rows, or the item currently selected in it. Shows a
   *  small spinner immediately before the title. One spinner covers BOTH reads: from the user's
   *  side there is one list and one wait, and two spinners in one header would be noise. */
  busy?: boolean
  /** Accessible name for this rail's `<aside>` landmark. Defaults to "Topic list", which every
   *  rail in the fleet shares — override only where a reader navigates to this surface BY
   *  landmark and needs it told apart from the sibling rails open beside it. Deliberately not
   *  derived from `title`: that would rename every existing rail at once. */
  railLabel?: string
  /** This list is covered (peeking) in the "covered" style: rows render as a left-aligned icon
   *  strip. The covered stack reveals the whole list on hover by re-layering the real rail
   *  full-width above its neighbours (there is no per-row/header popover). */
  covered?: boolean
  /** This is the ROOT (outermost) list — its selected row shows the leading gold dash (marker style). */
  isRoot?: boolean
  /** Selected-row marking: `"bar"` (classic gold bar; default) or `"marker"` (dash + connector). */
  selectionStyle?: "bar" | "marker"
  /** Full-width row between the titled header and the list — the hook for the shared
   *  `ListHeader` (filter + actions) when an entity list lives inside the stack.
   *  Hidden while the rail is collapsed to an icon strip. */
  headerSlot?: ReactNode
  /** Trailing chevron on every selectable row (narrow/nav-stack mode's disclosure hint — see
   *  {@link TopicList}'s doc). Default off. */
  rowDisclosure?: boolean
  /** A right-justified CLOSE (✕) button in the list HEADER. The hierarchical stacks pass it on
   *  every CHILD menu (never the root): clicking it dismisses the menu and clears the selection in
   *  the parent list that opened it. Omit to render no close button. */
  onClose?: () => void
  /** Accessible name + tooltip for the close button. Defaults to "Close". */
  closeLabel?: string
  /** Tighten the list's BOTTOM padding (the gap under the last row). Default false keeps the
   *  generous scroll breathing room; the cascade menus pass true so a short, hugging menu doesn't
   *  trail dead space under its last item. */
  denseBottom?: boolean
  /** Whether hovering an unselected row previews the left bar. Default true; the cascade menus pass
   *  false (see TopicList's `hoverBar`). */
  hoverBar?: boolean
  /** Drop the leading row icon in the EXPANDED list (see TopicList). Forwarded verbatim. */
  hideItemIcons?: boolean
  /** Warm a row before it is clicked — see {@link TopicList}'s `onPrefetch`. Forwarded straight
   *  through; this component neither calls it nor knows what it warms (data, a route, or both).
   *  It cannot: warming a ROUTE needs a router, and this package owns no router instance. */
  onPrefetch?: (id: string) => void
}) {
  const asideRef = useRef<HTMLElement>(null)
  const listId = useId()
  const draggingRef = useRef(false)
  const onDragStart = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    draggingRef.current = true
    onResizeStart?.()
  }
  const onDragMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !asideRef.current) return
    onResize?.(e.clientX - asideRef.current.getBoundingClientRect().left)
  }
  const onDragEnd = (e: PointerEvent<HTMLDivElement>) => {
    draggingRef.current = false
    onResizeEnd?.()
    e.currentTarget.releasePointerCapture?.(e.pointerId)
  }

  // The create affordance: a compact `+` right-justified in the header (replaces the old leading
  // "New…" rail row). Gold while a create is in progress (`newActive`). Icon-only, so its label
  // rides as the accessible name + native tooltip.
  const newButton = onNew ? (
    <button
      type="button"
      aria-label={newLabel ?? "New"}
      title={newLabel ?? "New"}
      onClick={onNew}
      className={cn(
        "flex shrink-0 items-center justify-center rounded p-0.5 outline-none hover:text-apt-text focus-visible:ring-2 focus-visible:ring-apt-gold/40",
        newActive ? "text-apt-gold" : "text-apt-text-muted",
      )}
    >
      <Plus size={16} aria-hidden />
    </button>
  ) : null

  const collapseToggle = (
    <CollapseToggle collapsed={collapsed} onToggle={onToggle} label="topic list" controls={listId} />
  )

  // A right-justified close (✕) in the header — the hierarchical stacks put it on every CHILD menu to
  // dismiss the menu and clear its selection in the parent list. Icon-only, so its label rides as the
  // accessible name + native tooltip.
  const closeButton = onClose ? (
    <button
      type="button"
      aria-label={closeLabel ?? "Close"}
      title={closeLabel ?? "Close"}
      onClick={onClose}
      className="flex shrink-0 items-center justify-center rounded p-0.5 text-apt-text-muted outline-none hover:text-apt-text focus-visible:ring-2 focus-visible:ring-apt-gold/40"
    >
      <X size={16} aria-hidden />
    </button>
  ) : null

  // Right-justified header controls: `titleActions` and, in the minimized style, the desktop collapse
  // toggle (`«`). The New `+` is NOT here — in the titled header it rides immediately after the title
  // (see `headerInner`); only the untitled header branches below render it on their own. The covered
  // style passes `showToggle=false` and supplies its own `leftControl` instead.
  const rightControls =
    titleActions || showToggle ? (
      <span className="ml-auto flex shrink-0 items-center gap-1">
        {titleActions}
        {showToggle && <span className="max-md:hidden">{collapseToggle}</span>}
      </span>
    ) : null

  // The titled header's inner content. The control slot is a fixed width matching where item icons
  // start; the title is CENTERED in the remaining header width with the New `+` immediately after it;
  // The read indicator, in two parts on purpose.
  //
  // This is the VISUAL half, and it is decoration: `aria-hidden`, because the live region mounted
  // on the column below already says the same thing, and two sources for one fact announce twice.
  // Defined once because it appears in every header shape — a rail the user collapsed to an icon
  // strip is still reading, and a strip that shows nothing while it reads makes the click that
  // started the read look like it did nothing.
  const busyIcon = <Loader2 className="size-3 animate-spin text-apt-text-muted" aria-hidden />
  // The ANNOUNCEMENT half. ALWAYS mounted, with its TEXT as the thing that changes: assistive tech
  // announces a live region's mutations, not its arrival, so a region inserted into the DOM at the
  // same instant it fills conveys nothing at all — which is what a `{busy && <span role="status">}`
  // amounts to. It sits on the column rather than in the header because every header shape can be
  // busy, including the two that have no title to hang the icon beside.
  const busyAnnouncement = (
    <span role="status" aria-live="polite" className="sr-only">
      {busy ? "Loading" : ""}
    </span>
  )

  // the toggle/close controls are right-justified.
  const headerInner = (
    <>
      <div className="flex w-8 shrink-0 items-center justify-center">{leftControl ?? backSlot ?? null}</div>
      {/* THE TITLE IS CENTERED ON THE HEADER ITSELF (Mike) — not on the space left over between the
          controls. As a `flex-1` item it centred within [leftControl … rightControls], so its centre
          sat `(32 - rightWidth) / 2` off the header's: it drifted whenever the trailing controls
          changed, and since only the frontier menu carries a ✕, sibling menus in one cascade centred
          their titles differently. Taking it OUT OF FLOW and pinning it to the header's midpoint makes
          it independent of every other icon, which is the rule asked for.
          The `+` HANGS off the title's right edge (absolute, `left-full`) rather than sitting beside it
          in flow, so "immediately after the title" costs the title no centring. It must live outside
          the `truncate` box — that box is `overflow-hidden` and would clip it. */}
      {title !== undefined && (
        <span className="pointer-events-none absolute left-1/2 flex max-w-[calc(100%-6rem)] -translate-x-1/2 items-center font-mono text-[0.8rem] tracking-[0.02em] text-apt-text-muted">
          <span className="relative flex min-w-0 items-center">
            {/* Hangs OFF the title's left edge, out of flow — the mirror of the `+` on the right.
                In flow it would shift the title sideways every time a read started, and the title
                is CENTRED on the header (see the note above), so the shift would be visible on
                every click. It must also live outside the `truncate` box, which would clip it. */}
            {busy && (
              <span
                data-htd-busy
                className="absolute top-1/2 right-full mr-1.5 -translate-y-1/2"
              >
                {busyIcon}
              </span>
            )}
            <span className="truncate">{title}</span>
            {newButton && (
              <span className="pointer-events-auto absolute top-1/2 left-full ml-1 -translate-y-1/2">
                {newButton}
              </span>
            )}
          </span>
        </span>
      )}
      {/* Eats the row so the trailing controls stay right-justified now the title is out of flow. */}
      <div className="min-w-0 flex-1" />
      {rightControls}
      {closeButton}
    </>
  )
  return (
    // .settings-nav: darker column, divider on the right, no left inset so the selection bar
    // sits flush against the edge.
    <aside
      ref={asideRef}
      aria-label={railLabel ?? "Topic list"}
      // A left drop-shadow (covered style) reads against `--color-shadow` (a token, not a raw
      // colour) so the child casts a physical edge over its covered parent. Referenced via a CSS
      // var so the project-guidelines colour checker stays clean (no raw hex / rgb()).
      className={cn(
        "relative flex min-h-0 flex-col border-r border-apt-border bg-apt-nav",
        coveredShadow && "shadow-[-10px_0_22px_-8px_var(--color-shadow)]",
        className,
      )}
    >
      {busyAnnouncement}
      {/* Drag handle on the trailing border (desktop): resize the column; the parent snaps to
          undisclosed below a third, full past the natural width. Fixed-width rails
          (no onResize) render no handle. */}
      {onResize && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize topic list"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          className="absolute top-0 right-0 z-10 h-full w-1.5 translate-x-1/2 cursor-col-resize touch-none bg-transparent transition-colors hover:bg-apt-gold/40 max-md:hidden"
        />
      )}
      {/* Top of the list. With a `title` (and not collapsed to an icon strip) this is the titled
          HEADER: a fixed control slot (the covered `«`/`»` or a minimized Back) where item icons
          start, the left-aligned title where item labels start, the right-justified New `+` / collapse
          toggle, and a divider beneath — so every titled list reserves the same header height and
          their rows line up. Without a title (standalone TopicDetail) or when collapsed, fall back to
          the bare control strip (priority: leftControl → backSlot → toggle/`+` → busy alone → nothing).
          EVERY shape carries the busy icon: collapsing a rail to make room for the detail pane is a
          first-class gesture, and the read a click starts is exactly as invisible in an icon strip as
          it is in a titled header — more so, since the strip has no title for it to sit beside. */}
      {title !== undefined && !collapsed ? (
        <div
          data-htd-header
          // `relative` anchors the absolutely-centred title in `headerInner`.
          className="relative flex min-h-[2.15rem] shrink-0 items-center gap-2 border-b border-apt-border pr-2"
        >
          {headerInner}
        </div>
      ) : leftControl ? (
        <div data-htd-header className="flex shrink-0 items-center justify-between px-1.5 pt-1.5">
          {leftControl}
          <span className="flex items-center gap-1">
            {busy && <span data-htd-busy>{busyIcon}</span>}
            {newButton}
            {closeButton}
          </span>
        </div>
      ) : backSlot ? (
        <div data-htd-header className="flex shrink-0 items-center justify-between px-1.5 pt-1.5">
          {backSlot}
          <span className="flex items-center gap-1">
            {busy && <span data-htd-busy>{busyIcon}</span>}
            {newButton}
            {showToggle && <span className="max-md:hidden">{collapseToggle}</span>}
          </span>
        </div>
      ) : showToggle || newButton ? (
        <div
          className={cn(
            "flex shrink-0 items-center gap-1 pt-1.5",
            // Collapsed icon strip (~48px): stack the `+` above the toggle. Else right-justify the row.
            collapsed ? "flex-col" : "justify-end pr-1.5",
            // Without a `+`, the strip is just the desktop-only collapse toggle — hidden on mobile.
            // The busy icon overrides that: a read in progress is worth showing on mobile too.
            !newButton && !busy && "max-md:hidden",
          )}
        >
          {busy && <span data-htd-busy>{busyIcon}</span>}
          {newButton}
          {showToggle && <span className={cn(newButton && "max-md:hidden")}>{collapseToggle}</span>}
        </div>
      ) : busy ? (
        // No title and no controls at all — a bare list that is nonetheless reading.
        <div
          data-htd-busy
          className={cn(
            "flex shrink-0 items-center pt-1.5",
            collapsed ? "justify-center" : "justify-end pr-1.5",
          )}
        >
          {busyIcon}
        </div>
      ) : null}
      {/* The shared list-header hook (filter + actions) for entity lists hosted in the
          stack — full-width under the titled header, above the rows. Hidden when the
          rail is collapsed to an icon strip (no room for a filter field). */}
      {headerSlot !== undefined && !collapsed && (
        <div className="shrink-0 border-b border-apt-border">{headerSlot}</div>
      )}
      <div
        id={listId}
        className={cn(
          "min-h-0 flex-1 overflow-y-auto",
          denseBottom ? "pb-2" : "pb-8",
          collapsed ? "pl-0 pr-1 pt-2" : "pl-0 pr-4 pt-2",
        )}
      >
        <TopicList
          items={items}
          selectedId={selectedId}
          onSelect={onSelect}
          emptyLabel={emptyLabel}
          railSlot={railSlot}
          railSlotActive={railSlotActive}
          collapsed={collapsed}
          covered={covered}
          isRoot={isRoot}
          selectionStyle={selectionStyle}
          hoverBar={hoverBar}
          hideItemIcons={hideItemIcons}
          rowDisclosure={rowDisclosure}
          onPrefetch={onPrefetch}
        />
      </div>
      {footer && <div className="shrink-0 border-t border-apt-border p-2">{footer}</div>}
    </aside>
  )
}

/**
 * The reusable two-pane primitive: a selectable [topic list] on the left and a
 * [detail pane] on the right — exactly the adh.com/home rail | content split.
 * That is ALL it is — no title row, no action bar. Compose those from other
 * blocks (see FocusedTopicDetail). Fills its container; give it a height.
 *
 * The rail is ALWAYS collapsible (a core part of the site design, not a config
 * flag): a top-right toggle (desktop only) shrinks the topic list to an icon-only
 * strip for more pane room — each topic stays clickable as its icon, the active
 * icon keeps the gold selection bar, and the header `+` stays put.
 */
export function TopicDetail({
  items,
  selectedId,
  onSelect,
  emptyLabel = "Nothing here yet.",
  railSlot,
  railSlotActive,
  onNew,
  newLabel,
  newActive,
  hideItemIcons,
  panePadding = true,
  collapsed: collapsedProp,
  onCollapsedChange,
  defaultCollapsed = false,
  railWidth: railWidthProp = FULL_RAIL,
  children,
}: {
  items: TopicDetailItem[]
  selectedId: string | null
  onSelect: (id: string) => void
  emptyLabel?: ReactNode
  /** Optional leading row above the topics (a custom header / control). Rendered only when provided;
   *  an absent slot reserves no space. Distinct from the header `+` create affordance (`onNew`). */
  railSlot?: RailSlot
  /** Move the gold selection bar onto the rail slot (nothing in the list selected). */
  railSlotActive?: boolean
  /** Create affordance: when set, a right-justified `+` in the list header fires it. */
  onNew?: () => void
  /** Accessible name + tooltip for the `+` (e.g. "New Topic"). Defaults to "New". */
  newLabel?: string
  /** Tint the `+` gold to signal an in-progress create (nothing selected in the list). */
  newActive?: boolean
  /** Drop the leading row icon in the expanded list — for lists whose rows carry no identity
   *  icon (see TopicList.hideItemIcons). */
  hideItemIcons?: boolean
  /** Default true: the pane carries the standard content inset (px-6 py-4 +
   *  gap-6). Pass false for edge-to-edge content (hub's .settings-content has
   *  no inset — each row carries its own, e.g. a ButtonBar) so consumers never
   *  need negative-margin hacks. */
  panePadding?: boolean
  /** Controlled collapse: pass with `onCollapsedChange` to drive the rail's
   *  collapsed state from outside (HierarchicalTopicDetail auto-minimizes
   *  ancestor rails this way). Omit for the default self-managed toggle. */
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  /** Initial collapsed state in uncontrolled mode (ignored when `collapsed` is set). */
  defaultCollapsed?: boolean
  /** The rail's natural (full) width in px; the drag handle clamps to it.
   *  Default FULL_RAIL (240) — the standard hub rail. Widen for rails whose
   *  rows are long identifiers (URLs). */
  railWidth?: number
  children: ReactNode
}) {
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed)
  // Standard controllable pattern: `collapsed` wins when provided, else local state.
  const collapsed = collapsedProp ?? internalCollapsed
  const setCollapsedState = (next: boolean) => {
    if (collapsedProp === undefined) setInternalCollapsed(next)
    onCollapsedChange?.(next)
  }
  const toggleCollapsed = () => setCollapsedState(!collapsed)

  // Drag-to-resize the rail by its trailing border (desktop). The width drives a `--rail-w`
  // CSS var; the transition is suppressed while dragging so the rail tracks the pointer live.
  const [railWidth, setRailWidth] = useState(railWidthProp)
  const [dragging, setDragging] = useState(false)
  const onResize = (w: number) => {
    if (w < railWidthProp / 3) {
      // Narrower than a third → animate to undisclosed.
      if (!collapsed) setCollapsedState(true)
      return
    }
    // Dragging out of (or within) the disclosed range; past FULL snaps back to full.
    if (collapsed) setCollapsedState(false)
    setRailWidth(Math.min(w, railWidthProp))
  }
  return (
    <div
      // The rail column width is driven by the `--rail-w` CSS var (collapsed → the icon strip,
      // else the dragged width); the var changes animate via the transition. The global
      // accessibility CSS (data-reduce-motion / OS pref) zeroes transition durations, so this
      // honours the user's "reduce animation" setting. Transition is off while dragging so the
      // rail tracks the pointer live.
      style={{ "--rail-w": collapsed ? `${COLLAPSED_RAIL}px` : `${railWidth}px` } as CSSProperties}
      className={cn(
        "grid min-h-0 min-w-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] md:[grid-template-columns:var(--rail-w)_minmax(0,1fr)]",
        !dragging && "md:transition-[grid-template-columns] md:duration-[calc(200ms*var(--apt-anim-scale,1))] md:ease-out",
      )}
    >
      <TopicRail
        items={items}
        selectedId={selectedId}
        onSelect={onSelect}
        emptyLabel={emptyLabel}
        railSlot={railSlot}
        railSlotActive={railSlotActive}
        onNew={onNew}
        newLabel={newLabel}
        newActive={newActive}
        hideItemIcons={hideItemIcons}
        collapsed={collapsed}
        onToggle={toggleCollapsed}
        onResize={onResize}
        onResizeStart={() => setDragging(true)}
        onResizeEnd={() => setDragging(false)}
      />
      {/* .settings-content: the surface panel for the whole right side. `overflow-auto` so a
          leaf detail with a minimum width scrolls horizontally here (rather than being crushed)
          when its column is narrower than that minimum; intermediate panes hold a shrinking grid
          so they never overflow. */}
      <section
        className={cn(
          "flex min-w-0 flex-col overflow-auto bg-apt-surface",
          panePadding && "gap-6 px-6 py-4",
        )}
      >
        {children}
      </section>
    </div>
  )
}
