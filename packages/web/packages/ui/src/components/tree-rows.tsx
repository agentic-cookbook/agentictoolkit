"use client"

import * as React from "react"
import { ChevronRight } from "lucide-react"

import { cn } from "../lib/utils"

/**
 * NESTING FOR A FLAT ROW LIST — the pieces a table needs to show a parent/child hierarchy
 * without becoming a different component.
 *
 * A {@link DataTable} renders the rows it is given, in order, one line each. That is the whole
 * reason this is a flattener and a label, not a `<TreeTable>`: the hierarchy is expressed by the
 * ORDER of the rows and the indent of their first cell, so every other column, the sorting, the
 * resizing, the selection and the keyboard behaviour keep working exactly as they do on a flat
 * table. Nothing here knows about tables either — the same two exports serve a list or a set of
 * cards.
 *
 * Split in two on purpose: {@link flattenTree} is pure and React-free (it is the part with edge
 * cases worth testing directly), and {@link TreeRowLabel} is the affordance.
 */

/** One visible row: the caller's own row object, plus where it sits in the hierarchy. */
export interface TreeRow<T> {
  row: T
  /** 0 for a root; +1 per ancestor. Feeds the label's indent. */
  depth: number
  /** Whether this row has children AT ALL — a leaf renders no toggle, not a disabled one. */
  hasChildren: boolean
}

export interface FlattenTreeOptions<T> {
  id: (row: T) => string
  /** The row's parent id, or null/undefined for a root. */
  parentId: (row: T) => string | null | undefined
  /** Ids whose children are shown. Omit to expand everything (a tree with no toggle). */
  expanded?: ReadonlySet<string>
  /** Order siblings within one parent. Omit to keep the input order. */
  compare?: (a: T, b: T) => number
}

/**
 * Depth-first flatten of a parent/child forest into the visible rows, in display order.
 *
 * The two cases that decide whether this is correct in the wild, because a `parentId` is just a
 * string and nothing stops it being wrong:
 *
 *  - **An ORPHAN** — a row whose parent is not in `rows` (filtered out, deleted, or in another
 *    project) — is treated as a ROOT. Dropping it would make a row vanish from a view that claims
 *    to show everything, which is the worse failure by far: an unexplained absence is invisible,
 *    whereas a top-level row merely reads as un-nested.
 *  - **A CYCLE** (a → b → a, or a row parented to itself) has no roots to descend from, so the
 *    members would silently disappear for the same reason. Any row not reached by the descent is
 *    therefore appended at depth 0. The output is a permutation of the input: every row appears
 *    exactly once, always.
 */
export function flattenTree<T>(
  rows: readonly T[],
  { id, parentId, expanded, compare }: FlattenTreeOptions<T>,
): TreeRow<T>[] {
  const present = new Set(rows.map(id))
  const childrenOf = new Map<string, T[]>()
  const roots: T[] = []

  for (const row of rows) {
    const parent = parentId(row)
    // Self-parenting is its own smallest cycle; catch it here so it reads as a root.
    if (parent && parent !== id(row) && present.has(parent)) {
      const siblings = childrenOf.get(parent)
      if (siblings) siblings.push(row)
      else childrenOf.set(parent, [row])
    } else {
      roots.push(row)
    }
  }

  if (compare) {
    roots.sort(compare)
    for (const siblings of childrenOf.values()) siblings.sort(compare)
  }

  const out: TreeRow<T>[] = []
  // REACHED, not "emitted". The descent enters a collapsed row's subtree even though it renders
  // none of it, because the two questions are different: a hidden descendant has been accounted
  // for, and the cycle sweep below must not mistake it for a lost row and re-emit it as a root.
  const reached = new Set<string>()

  function walk(row: T, depth: number, visible: boolean): void {
    const key = id(row)
    if (reached.has(key)) return
    reached.add(key)
    const children = childrenOf.get(key)
    if (visible) out.push({ row, depth, hasChildren: children != null && children.length > 0 })
    if (!children) return
    const childrenVisible = visible && (!expanded || expanded.has(key))
    for (const child of children) walk(child, depth + 1, childrenVisible)
  }

  for (const root of roots) walk(root, 0, true)
  // Whatever the descent never reached is in a cycle. Surface it rather than lose it.
  for (const row of rows) if (!reached.has(id(row))) walk(row, 0, true)

  return out
}

/** Every ancestor id in `rows` — what a caller expands so that `focusId` is visible. */
export function ancestorIds<T>(
  rows: readonly T[],
  focusId: string,
  { id, parentId }: Pick<FlattenTreeOptions<T>, "id" | "parentId">,
): Set<string> {
  const byId = new Map(rows.map((r) => [id(r), r]))
  const out = new Set<string>()
  let cursor = byId.get(focusId)
  // Bounded by the row count, so a cycle terminates instead of spinning.
  for (let hops = 0; cursor && hops <= rows.length; hops++) {
    const parent = parentId(cursor)
    if (!parent || out.has(parent)) break
    out.add(parent)
    cursor = byId.get(parent)
  }
  return out
}

/** Ems of indent per level. Deep enough to read as a step, shallow enough that five levels of
 *  nesting still leave a title room to be a title. */
const INDENT_EM = 1.25

/**
 * The first cell of a nested row: the indent, the expand/collapse toggle, then the caller's own
 * content (a title, a link, an editable field — this component does not care).
 *
 * A LEAF still gets the toggle's width as blank space, so titles line up in a column instead of
 * shifting by a chevron depending on whether a row happens to have children.
 *
 * The chevron is the family's disclosure glyph (`ChevronRight`, rotated when open) — the same one
 * {@link Disclosure} uses — because this is the same gesture in a different container, and the
 * arrow that means "open this" should not change shape between them.
 */
export function TreeRowLabel({
  depth,
  hasChildren,
  expanded,
  onToggle,
  label,
  className,
  children,
}: {
  depth: number
  hasChildren: boolean
  expanded: boolean
  onToggle: () => void
  /** Names the row for the toggle's accessible name: "Expand {label}" / "Collapse {label}". */
  label: string
  className?: string
  children: React.ReactNode
}): React.ReactElement {
  const text = `${expanded ? "Collapse" : "Expand"} ${label}`
  return (
    <span
      className={cn("flex min-w-0 items-center gap-1", className)}
      style={{ paddingInlineStart: `${depth * INDENT_EM}em` }}
    >
      {hasChildren ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={text}
          aria-expanded={expanded}
          title={text}
          className="shrink-0 rounded p-0.5 text-apt-text-muted outline-none hover:text-apt-text focus-visible:ring-2 focus-visible:ring-apt-gold/40"
        >
          <ChevronRight
            size={14}
            className={cn("transition-transform", expanded && "rotate-90")}
          />
        </button>
      ) : (
        // Matches the button's box exactly, so a leaf's content starts where a parent's does.
        <span aria-hidden className="shrink-0 p-0.5">
          <span className="block size-[14px]" />
        </span>
      )}
      {children}
    </span>
  )
}
