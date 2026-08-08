"use client"

import * as React from "react"
import { GripVertical } from "lucide-react"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCorners,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  type Modifier,
  type UniqueIdentifier,
} from "@dnd-kit/core"
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

import { cn } from "../lib/utils"

// Drag-and-drop, in the two shapes the platform's views actually need. Both are thin over
// @dnd-kit — the point of the wrapper is not to hide the library, it is to make every surface
// speak ONE vocabulary for where a thing landed, because that vocabulary is the part the server
// already fixed.
//
//  - **SortableSurface** — an ORDERED collection, in one zone (a list) or several (a board's
//    columns). A drop reports the two cards the dragged one landed BETWEEN, never an index.
//    That is not a stylistic preference: an index is a claim about the whole list, so two people
//    reordering at once each compute one against a list the other already changed and the loser's
//    card lands somewhere nobody chose. A pair of neighbours is a claim about two rows, and it
//    stays true whatever happens elsewhere. It is also, not by coincidence, exactly the request
//    the ordering endpoint takes, so a view can pass a drop straight through without translating
//    a position into a rank it has no business computing.
//  - **DragSurface** — an UNORDERED placement: the dragged thing lands ON something (a calendar
//    day) or simply MOVES (a timeline bar shifted along its axis). A drop reports the target it
//    landed on and the pixel delta it travelled; what either means is the view's to say.
//
// ## The keyboard is not an afterthought, but it is not always THIS
//
// A pointer drag is a gesture nobody can perform with a keyboard, so every surface that offers
// one has to offer something else too. Where the dragged element can carry `attributes` — a
// board card, a list row's grip — this installs dnd-kit's own keyboard sensor and the drag works
// from the keyboard directly. Where it CANNOT, because the draggable already sits inside a
// button (a calendar chip, a timeline bar), spreading `attributes` would nest one `role="button"`
// inside another; those surfaces spread `listeners` alone and their keyboard path is the field
// the drag writes — the editor's date inputs. Both are honest; what would not be is a drag with
// no second path at all, and `ReorderControl` exists for the same reason.

/** One zone's items, in the order they are rendered. */
export interface SortableZoneModel {
  id: string
  itemIds: readonly string[]
}

/** Where a dragged item landed, as the neighbours it sits between. */
export interface SortableDrop {
  itemId: string
  /** The zone it was picked up from. */
  fromZoneId: string
  /** The zone it was dropped into — the same one for a plain reorder. */
  toZoneId: string
  /** The item it landed BELOW, or null when it landed at the top of the zone. */
  afterId: string | null
  /** The item it landed ABOVE, or null when it landed at the bottom. */
  beforeId: string | null
}

export interface SortableSurfaceProps {
  /**
   * Every zone and its items, in render order. This is what turns an `over` into neighbours, so
   * it has to describe what is on SCREEN — a filtered view passes the filtered ids.
   */
  zones: readonly SortableZoneModel[]
  onDrop: (drop: SortableDrop) => void
  /** Accessible name for an item, used in the drag announcements. Defaults to the id. */
  describeItem?: (itemId: string) => string
  /** Accessible name for a zone, likewise. Defaults to the id. */
  describeZone?: (zoneId: string) => string
  /** Rendered under the pointer while a drag is live. Omit for no overlay. */
  renderOverlay?: (itemId: string) => React.ReactNode
  /**
   * The axis the zones' items are laid out along — which is how a drop decides whether a card
   * landed before or after the one it is over. Vertical by default; a board's COLUMNS run
   * horizontally but its cards do not, so a board is vertical too.
   */
  orientation?: "vertical" | "horizontal"
  children: React.ReactNode
}

/** Pointer drags start after a few px so a CLICK on a draggable card still reaches its own
 *  handler; without this every card would have to distinguish the two itself. */
const POINTER_ACTIVATION = { distance: 5 } as const

/** Droppables are re-measured continuously: a board column that grows as cards land in it, or a
 *  list that scrolls mid-drag, otherwise keeps the rect it had when the drag began. */
const MEASURING = { droppable: { strategy: MeasuringStrategy.Always } } as const

function useDragSensors(keyboard: boolean) {
  const pointer = useSensor(PointerSensor, { activationConstraint: POINTER_ACTIVATION })
  const keys = useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  // `useSensors` wants a stable-length list; passing `false` for the unwanted one is how dnd-kit
  // itself spells a conditional sensor.
  return useSensors(pointer, keyboard ? keys : null)
}

/** True when the dragged rect's centre has passed the centre of the thing it is over — i.e. it
 *  should land AFTER it rather than before. Works across zones, where an index comparison
 *  cannot, because both rects are in viewport coordinates. */
function landsAfter(
  event: DragEndEvent,
  orientation: "vertical" | "horizontal",
): boolean {
  const moved = event.active.rect.current.translated
  const over = event.over?.rect
  if (!moved || !over) return false
  return orientation === "horizontal"
    ? moved.left + moved.width / 2 > over.left + over.width / 2
    : moved.top + moved.height / 2 > over.top + over.height / 2
}

/**
 * dnd-kit's listener map and draggable attributes, narrowed to the JSX props they in fact are.
 *
 * The cast is the whole point rather than a shortcut: `SyntheticListenerMap` is
 * `Record<string, Function>`, and an index signature spread into JSX makes TypeScript accept ANY
 * prop on the receiving element — so every card and row that spread it raw would quietly lose
 * its own prop checking. This is the one place that widening is contained.
 */
function asHandleProps(
  listeners: object | undefined,
  attributes: object | undefined,
): React.HTMLAttributes<HTMLElement> {
  return { ...listeners, ...attributes } as React.HTMLAttributes<HTMLElement>
}

/** The surface tells its zones which axis they sort along, so a zone does not have to be told
 *  twice (once for its sorting strategy, once for the drop math). */
const OrientationContext = React.createContext<"vertical" | "horizontal">("vertical")

export function SortableSurface({
  zones,
  onDrop,
  describeItem,
  describeZone,
  renderOverlay,
  orientation = "vertical",
  children,
}: SortableSurfaceProps): React.ReactElement {
  const sensors = useDragSensors(true)
  const [dragging, setDragging] = React.useState<string | null>(null)

  const nameOf = React.useCallback(
    (id: string) => describeItem?.(id) ?? id,
    [describeItem],
  )
  const zoneName = React.useCallback(
    (id: string) => describeZone?.(id) ?? id,
    [describeZone],
  )

  // Which zone holds each item, and each zone's items. Rebuilt whenever the caller's model
  // changes, which it does on every load — the drop math reads these, never React state.
  const { zoneOfItem, itemsOfZone } = React.useMemo(() => {
    const zoneOfItem = new Map<string, string>()
    const itemsOfZone = new Map<string, readonly string[]>()
    for (const z of zones) {
      itemsOfZone.set(z.id, z.itemIds)
      for (const id of z.itemIds) zoneOfItem.set(id, z.id)
    }
    return { zoneOfItem, itemsOfZone }
  }, [zones])

  const onDragStart = React.useCallback((e: DragStartEvent) => {
    setDragging(String(e.active.id))
  }, [])

  const onDragEnd = React.useCallback(
    (e: DragEndEvent) => {
      setDragging(null)
      const over = e.over
      if (!over) return
      const itemId = String(e.active.id)
      const fromZoneId = zoneOfItem.get(itemId)
      if (fromZoneId === undefined) return

      // `over` is either another item or a zone's own droppable — the latter is how an EMPTY
      // column is reachable at all, and it means "the end of that zone".
      const overId = String(over.id)
      const overIsZone = itemsOfZone.has(overId)
      const toZoneId = overIsZone ? overId : zoneOfItem.get(overId)
      if (toZoneId === undefined) return

      // The destination WITHOUT the dragged card: its old slot is not a place anything can land
      // between, and leaving it in would make every drop report itself as landing beside itself.
      const dest = (itemsOfZone.get(toZoneId) ?? []).filter((id) => id !== itemId)
      let index: number
      if (overIsZone) {
        index = dest.length
      } else {
        const overIndex = dest.indexOf(overId)
        if (overIndex < 0) return
        index = overIndex + (landsAfter(e, orientation) ? 1 : 0)
      }

      const afterId = index > 0 ? (dest[index - 1] ?? null) : null
      const beforeId = index < dest.length ? (dest[index] ?? null) : null

      // A drag that ends where it started is not a move. Reporting it anyway would spend a write
      // (and a re-read of every view) on a card the user only jiggled.
      if (toZoneId === fromZoneId) {
        const source = itemsOfZone.get(fromZoneId) ?? []
        const at = source.indexOf(itemId)
        if (at >= 0 && (source[at - 1] ?? null) === afterId && (source[at + 1] ?? null) === beforeId)
          return
      }
      onDrop({ itemId, fromZoneId, toZoneId, afterId, beforeId })
    },
    [itemsOfZone, onDrop, orientation, zoneOfItem],
  )

  const announcements = React.useMemo<Announcements>(
    () => ({
      onDragStart: ({ active }) => `Picked up ${nameOf(String(active.id))}.`,
      onDragOver: ({ active, over }) =>
        over
          ? `${nameOf(String(active.id))} is over ${
              itemsOfZone.has(String(over.id))
                ? zoneName(String(over.id))
                : nameOf(String(over.id))
            }.`
          : `${nameOf(String(active.id))} is over no drop target.`,
      onDragEnd: ({ active, over }) =>
        over
          ? `${nameOf(String(active.id))} was dropped.`
          : `${nameOf(String(active.id))} was returned to where it started.`,
      onDragCancel: ({ active }) =>
        `Dragging ${nameOf(String(active.id))} was cancelled.`,
    }),
    [itemsOfZone, nameOf, zoneName],
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      measuring={MEASURING}
      accessibility={{ announcements }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <OrientationContext.Provider value={orientation}>{children}</OrientationContext.Provider>
      {renderOverlay && (
        <DragOverlay>{dragging ? renderOverlay(dragging) : null}</DragOverlay>
      )}
    </DndContext>
  )
}

export interface SortableZoneProps {
  id: string
  /** This zone's items in render order — the same array given to the surface for this zone. */
  itemIds: readonly string[]
  children: (state: {
    /** Put this on the zone's own box. It must be a real box, not `display:contents`: a zone
     *  with no rect can never be the drop target, which is exactly the EMPTY column case. */
    setNodeRef: (node: HTMLElement | null) => void
    isOver: boolean
  }) => React.ReactNode
}

/** One ordered group inside a {@link SortableSurface}: a list, or a single board column. Its own
 *  droppable is what makes an EMPTY zone reachable at all — with only the items registered, a
 *  column with nothing in it has nothing to collide with and no card could ever be dropped in. */
export function SortableZone({ id, itemIds, children }: SortableZoneProps): React.ReactElement {
  const orientation = React.useContext(OrientationContext)
  const { setNodeRef, isOver } = useDroppable({ id })
  // A fresh array so SortableContext re-registers when the zone's contents change; dnd-kit
  // memoises on identity.
  const items = React.useMemo<UniqueIdentifier[]>(() => [...itemIds], [itemIds])
  return (
    <SortableContext
      items={items}
      strategy={
        orientation === "horizontal"
          ? horizontalListSortingStrategy
          : verticalListSortingStrategy
      }
    >
      {children({ setNodeRef, isOver })}
    </SortableContext>
  )
}

/** What a draggable hands back to whatever renders it. */
export interface DragRenderState {
  /** Put this on the element that MOVES. */
  setNodeRef: (node: HTMLElement | null) => void
  /** Put this on the same element — it carries the live transform. */
  style: React.CSSProperties
  /**
   * Spread on the element that STARTS the drag. Includes dnd-kit's `attributes` only when the
   * caller asked for a keyboard-operable handle; see the note at the top of this file.
   *
   * Narrowed to `HTMLAttributes` at this boundary rather than passed through as dnd-kit's own
   * `Record<string, Function>`: an index-signature object spread into JSX types every element it
   * touches as "anything goes", which would silently accept a typo'd prop on every card and row
   * that renders one. Every key dnd-kit actually supplies — the pointer/keyboard handlers, `role`,
   * `tabIndex`, the `aria-*` pair — is an HTMLAttribute, so the narrowing loses nothing real.
   */
  handleProps: React.HTMLAttributes<HTMLElement>
  /** This item is the one being dragged right now. */
  dragging: boolean
}

export interface SortableItemProps {
  id: string
  /** False for a row that may not be dragged (a filtered list, a busy row). */
  enabled?: boolean
  /**
   * Spread dnd-kit's `attributes` onto the handle — which makes it `role="button"` and focusable,
   * so the keyboard sensor can drive it. Turn it OFF when the handle is already inside a button:
   * a nested `role="button"` is invalid, and the surface's keyboard path is elsewhere.
   */
  keyboard?: boolean
  children: (state: DragRenderState) => React.ReactNode
}

export function SortableItem({
  id,
  enabled = true,
  keyboard = true,
  children,
}: SortableItemProps): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !enabled,
  })
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    // The card under the pointer is the overlay's; the original stays in the flow so the gap it
    // leaves is where the drop preview goes.
    opacity: isDragging ? 0.4 : undefined,
  }
  return (
    <>
      {children({
        setNodeRef,
        style,
        handleProps: enabled ? asHandleProps(listeners, keyboard ? attributes : undefined) : {},
        dragging: isDragging,
      })}
    </>
  )
}

/** Where a free (unordered) drag ended. */
export interface DragDropEvent {
  itemId: string
  /** The drop target it landed on, or null when it landed on none. */
  targetId: string | null
  /** How far it travelled, in CSS pixels. The only signal a surface with no targets has. */
  delta: { x: number; y: number }
}

export interface DragSurfaceProps {
  onDrop: (event: DragDropEvent) => void
  describeItem?: (itemId: string) => string
  describeTarget?: (targetId: string) => string
  renderOverlay?: (itemId: string) => React.ReactNode
  /** Constrain the drag to one axis. A timeline bar means a DATE, so vertical travel is noise. */
  axis?: "x" | "y"
  /** Install the keyboard sensor. Off when the draggables sit inside buttons (see the file note). */
  keyboard?: boolean
  children: React.ReactNode
}

const LOCK_Y: Modifier = ({ transform }) => ({ ...transform, y: 0 })
const LOCK_X: Modifier = ({ transform }) => ({ ...transform, x: 0 })

/**
 * A drag with no order in it: the thing lands ON a target, or simply moves. Calendar drops a chip
 * onto a day; Timeline slides a bar and reads the distance. Both write a FIELD, so neither has
 * neighbours to report and neither belongs in {@link SortableSurface}.
 */
export function DragSurface({
  onDrop,
  describeItem,
  describeTarget,
  renderOverlay,
  axis,
  keyboard = false,
  children,
}: DragSurfaceProps): React.ReactElement {
  const sensors = useDragSensors(keyboard)
  const [dragging, setDragging] = React.useState<string | null>(null)
  const nameOf = React.useCallback((id: string) => describeItem?.(id) ?? id, [describeItem])
  const targetName = React.useCallback(
    (id: string) => describeTarget?.(id) ?? id,
    [describeTarget],
  )

  const modifiers = React.useMemo<Modifier[]>(
    () => (axis === "x" ? [LOCK_Y] : axis === "y" ? [LOCK_X] : []),
    [axis],
  )

  const announcements = React.useMemo<Announcements>(
    () => ({
      onDragStart: ({ active }) => `Picked up ${nameOf(String(active.id))}.`,
      onDragOver: ({ active, over }) =>
        over
          ? `${nameOf(String(active.id))} is over ${targetName(String(over.id))}.`
          : `${nameOf(String(active.id))} is over no drop target.`,
      onDragEnd: ({ active, over }) =>
        over
          ? `${nameOf(String(active.id))} was dropped on ${targetName(String(over.id))}.`
          : `${nameOf(String(active.id))} was dropped.`,
      onDragCancel: ({ active }) => `Dragging ${nameOf(String(active.id))} was cancelled.`,
    }),
    [nameOf, targetName],
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      measuring={MEASURING}
      modifiers={modifiers}
      accessibility={{ announcements }}
      onDragStart={(e) => setDragging(String(e.active.id))}
      onDragEnd={(e) => {
        setDragging(null)
        onDrop({
          itemId: String(e.active.id),
          targetId: e.over ? String(e.over.id) : null,
          delta: { x: e.delta.x, y: e.delta.y },
        })
      }}
      onDragCancel={() => setDragging(null)}
    >
      {children}
      {renderOverlay && <DragOverlay>{dragging ? renderOverlay(dragging) : null}</DragOverlay>}
    </DndContext>
  )
}

export interface DragItemProps {
  id: string
  enabled?: boolean
  /** See {@link SortableItemProps.keyboard} — off by default here, because these draggables
   *  usually live inside a button that already owns the role. */
  keyboard?: boolean
  children: (state: DragRenderState) => React.ReactNode
}

export function DragItem({
  id,
  enabled = true,
  keyboard = false,
  children,
}: DragItemProps): React.ReactElement {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    disabled: !enabled,
  })
  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    // A dragged bar/chip stays legible under the pointer rather than ghosting: there is no
    // overlay stand-in for these, the element itself is what moves.
    zIndex: isDragging ? 20 : undefined,
    position: isDragging ? "relative" : undefined,
  }
  return (
    <>
      {children({
        setNodeRef,
        style,
        handleProps: enabled ? asHandleProps(listeners, keyboard ? attributes : undefined) : {},
        dragging: isDragging,
      })}
    </>
  )
}

export interface DropTargetProps {
  id: string
  enabled?: boolean
  children: (state: { setNodeRef: (node: HTMLElement | null) => void; isOver: boolean }) => React.ReactNode
}

/** One landing place inside a {@link DragSurface} — a calendar day, a bucket, a lane. */
export function DropTarget({ id, enabled = true, children }: DropTargetProps): React.ReactElement {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !enabled })
  return <>{children({ setNodeRef, isOver: enabled && isOver })}</>
}

/* ── The grip ─────────────────────────────────────────────────────────────── */

export interface DragGripProps extends React.HTMLAttributes<HTMLElement> {
  /** What is being dragged — becomes the handle's accessible name ("Reorder <subject>"). */
  subject?: string
}

/**
 * The handle for a draggable that is NOT itself the drag target — a dense row, where the whole
 * element is a click target for something else (selecting it, editing a cell) and only this
 * corner picks it up. A board card needs no grip: the card IS the thing you grab, and a grip
 * would shrink that target to a few pixels for no gain.
 *
 * It renders a `span`, never a `button`, because {@link SortableItem} may spread dnd-kit's
 * `attributes` here — `role="button"` and `tabIndex` among them — and a `role="button"` inside a
 * `<button>` is invalid. The visible affordance is the grab cursor plus the icon; the accessible
 * one is the name below and, when the keyboard sensor is installed, the role those attributes add.
 */
export function DragGrip({ subject, className, ...rest }: DragGripProps): React.ReactElement {
  return (
    <span
      aria-label={subject ? `Reorder ${subject}` : "Reorder"}
      {...rest}
      className={cn(
        // `touch-none` is load-bearing on a touch screen: without it the browser claims the
        // gesture for scrolling and the pointer sensor never sees a move.
        "inline-flex h-6 w-4 shrink-0 cursor-grab touch-none items-center justify-center rounded text-apt-text-muted outline-none transition-colors hover:text-apt-text focus-visible:ring-2 focus-visible:ring-apt-gold/25 active:cursor-grabbing",
        className,
      )}
    >
      <GripVertical size={14} aria-hidden />
    </span>
  )
}
