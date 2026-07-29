"use client"

// HDV's left column: the document tree, and the chrome that carries it — a
// sticky aside on desktop, a slide-over drawer below `lg`.
//
// The tree is ONE recursive component with three renderings, chosen by where a
// node sits rather than by anything the node declares:
//
//   depth 0, the section  — a collapse control plus a mono uppercase label; the
//                           only level that opens and closes.
//   depth 1+, a branch    — a link, then its children, always shown. It is
//                           already inside a section the reader chose to open;
//                           a second latch on the way down buys nothing.
//   a leaf                — a link, plus the page's own headings when the host
//                           supplied them.
//
// The drawer's open state is CONTROLLED, and that is the whole point: the button
// that opens it lives in the site header, outside this subtree. An uncontrolled
// drawer would leave that button silently dead.
//
// HDV never subscribes to the router. The host passes `activePath` from its own
// client component — see doc-types.ts.

import type { HTMLAttributes, ReactNode } from "react"
import { useState } from "react"
import { ChevronRight, X } from "lucide-react"

import { cn } from "../lib/utils"
import { DefaultDocLink } from "./doc-link"
import type { DocLinkComponent, DocNavTopLink, HdvNavNode } from "./doc-types"

/** The desktop column: sticky under a 3.5rem header, scrolling on its own. */
export const DOC_NAV_ASIDE_CLASS =
  "hidden lg:block w-80 shrink-0 border-r border-[var(--color-border-subtle)] overflow-y-auto sticky top-14 h-[calc(100vh-3.5rem)]"

/** The nav element itself, shared verbatim by the aside and the drawer. */
export const DOC_NAV_NAV_CLASS =
  "flex flex-col gap-6 px-6 py-6 overflow-y-auto h-full"

/** The mobile slide-over panel. */
export const DOC_NAV_DRAWER_CLASS =
  "fixed inset-y-0 left-0 w-72 bg-[var(--color-surface)] shadow-xl overflow-y-auto"

/** A section's label: mono, uppercase, accented — the tree's loudest type. */
export const DOC_NAV_SECTION_LABEL_CLASS =
  "font-mono text-xs font-medium uppercase tracking-widest text-[var(--color-accent)] transition-colors"

/** A top link's heading. Same type as a section label, without the control. */
export const DOC_NAV_TOP_LINK_CLASS =
  "relative font-mono text-xs font-medium uppercase tracking-widest text-[var(--color-accent)] transition-colors"

/** A section's child list — the rule that runs down the left of its contents. */
export const DOC_NAV_SECTION_LIST_CLASS =
  "flex flex-col border-l border-[var(--color-border)] mt-1"

/** Every list below the first: the same rule, indented past its parent's text. */
export const DOC_NAV_BRANCH_LIST_CLASS =
  "flex flex-col border-l border-[var(--color-border)] ml-3.5"

/** Links and headings share one indent, so their text lines up down the column. */
const ITEM_INDENT = { paddingInlineStart: "0.875rem" } as const

const branchesOf = (node: HdvNavNode) =>
  (node.children ?? []).filter((child) => (child.children ?? []).length > 0)

const leavesOf = (node: HdvNavNode) =>
  (node.children ?? []).filter((child) => (child.children ?? []).length === 0)

interface LevelProps {
  node: HdvNavNode
  activePath: string
  LinkComponent: DocLinkComponent
}

/**
 * A page's own headings, inlined under its link. Clicking one while its page is
 * already open scrolls instead of navigating, and writes the hash so the
 * position is linkable; from any other page it is an ordinary link.
 */
function NavHeadings({ node, activePath }: Omit<LevelProps, "LinkComponent">) {
  const headings = node.headings ?? []
  if (headings.length === 0) return null

  const onPage = activePath === node.href

  return (
    <ul className={DOC_NAV_BRANCH_LIST_CLASS}>
      {headings.map((heading) => {
        const href = `${node.href}#${heading.id}`
        return (
          <li key={heading.id}>
            {/* A plain anchor, not `LinkComponent`: this is a scroll target on
                the page the reader is already on. */}
            <a
              href={href}
              onClick={(event) => {
                if (!onPage) return
                event.preventDefault()
                const element = document.getElementById(heading.id)
                if (!element) return
                element.scrollIntoView({ behavior: "smooth" })
                window.history.replaceState(null, "", href)
              }}
              className="relative block py-0.5 text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text-secondary)] transition-colors"
              style={ITEM_INDENT}
            >
              {heading.text}
            </a>
          </li>
        )
      })}
    </ul>
  )
}

/** A page. */
function NavLeaf({ node, activePath, LinkComponent }: LevelProps) {
  const selected = activePath === node.href

  return (
    <li>
      <LinkComponent
        to={node.href}
        aria-current={selected ? "page" : undefined}
        className={`relative block py-0.5 text-sm transition-colors ${
          selected
            ? "font-semibold text-[var(--color-text-primary)]"
            : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        }`}
        style={ITEM_INDENT}
      >
        {selected && (
          <span className="absolute left-0 top-0.5 bottom-0.5 w-px bg-[var(--color-accent)]" />
        )}
        {node.label}
      </LinkComponent>
      <NavHeadings node={node} activePath={activePath} />
    </li>
  )
}

/**
 * A directory below the first level: its own link, then its contents.
 *
 * Two sibling `<li>`s rather than a nested one, so the child list's rule starts
 * at the parent's left edge instead of inside its list item.
 */
function NavBranch({ node, activePath, LinkComponent }: LevelProps) {
  const selected = activePath === node.href
  const ancestor = activePath.startsWith(node.href + "/")

  return (
    <>
      <li>
        <LinkComponent
          to={node.href}
          aria-current={selected ? "page" : undefined}
          className={`relative block py-1 text-sm transition-colors ${
            selected
              ? "font-semibold text-[var(--color-text-primary)]"
              : ancestor
                ? "font-medium text-[var(--color-text-primary)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
          style={ITEM_INDENT}
        >
          {selected && (
            <span className="absolute left-0 top-1 bottom-1 w-px bg-[var(--color-accent)]" />
          )}
          {node.label}
        </LinkComponent>
      </li>
      <NavChildren
        node={node}
        activePath={activePath}
        LinkComponent={LinkComponent}
        className={DOC_NAV_BRANCH_LIST_CLASS}
        wrapInListItem
      />
    </>
  )
}

/**
 * A node's children as a list: pages first, then directories.
 *
 * The order is deliberate and does not follow the caller's array. A reader
 * scanning a section wants its own pages before its sub-trees, and the tree
 * would otherwise read differently at every level depending on how the host
 * happened to sort.
 */
function NavChildren({
  node,
  activePath,
  LinkComponent,
  className,
  wrapInListItem = false,
}: LevelProps & { className: string; wrapInListItem?: boolean }) {
  const leaves = leavesOf(node)
  const branches = branchesOf(node)
  if (leaves.length === 0 && branches.length === 0) return null

  const list = (
    <ul className={className}>
      {leaves.map((child) => (
        <NavLeaf
          key={child.href}
          node={child}
          activePath={activePath}
          LinkComponent={LinkComponent}
        />
      ))}
      {branches.map((child) => (
        <NavBranch
          key={child.href}
          node={child}
          activePath={activePath}
          LinkComponent={LinkComponent}
        />
      ))}
    </ul>
  )

  return wrapInListItem ? <li>{list}</li> : list
}

/**
 * A top-level section: the one level that collapses.
 *
 * It opens if the reader is inside it WHEN IT MOUNTS, and is theirs from then
 * on — re-deriving the state on every route change would slam a section shut
 * under someone who had just opened it to browse.
 */
function NavSection({ node, activePath, LinkComponent }: LevelProps) {
  const selected = activePath === node.href
  const inside = activePath.startsWith(node.href + "/")
  const [expanded, setExpanded] = useState(selected || inside)

  return (
    <div className="flex flex-col gap-1">
      <div className="relative flex items-center gap-1">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Collapse" : "Expand"} ${node.label}`}
          className="p-0.5 text-[var(--color-text-dim)] hover:text-[var(--color-text-secondary)] transition-colors"
        >
          <ChevronRight
            className={cn(
              "h-3 w-3 shrink-0 transition-transform duration-150",
              expanded && "rotate-90",
            )}
            strokeWidth={2.5}
          />
        </button>
        {selected && (
          <span className="absolute -left-6 top-0 bottom-0 w-0.5 bg-[var(--color-accent)]" />
        )}
        <LinkComponent to={node.href} className={DOC_NAV_SECTION_LABEL_CLASS}>
          {node.label}
        </LinkComponent>
      </div>
      {expanded && (
        <NavChildren
          node={node}
          activePath={activePath}
          LinkComponent={LinkComponent}
          className={DOC_NAV_SECTION_LIST_CLASS}
        />
      )}
    </div>
  )
}

export interface DocNavTreeProps {
  /** Top-level sections, in the order they should appear. */
  nodes: HdvNavNode[]
  /** The current route. A prop, never a router subscription — see doc-types.ts. */
  activePath: string
  /** The host's router link. Defaults to a plain `<a href>`. */
  LinkComponent?: DocLinkComponent
}

export function DocNavTree({
  nodes,
  activePath,
  LinkComponent = DefaultDocLink,
}: DocNavTreeProps) {
  return (
    <>
      {nodes.map((node) => (
        <NavSection
          key={node.href}
          node={node}
          activePath={activePath}
          LinkComponent={LinkComponent}
        />
      ))}
    </>
  )
}

export interface DocNavProps
  extends Omit<HTMLAttributes<HTMLElement>, "children" | "title"> {
  /** Top-level sections of the document tree. */
  nodes: HdvNavNode[]
  /** The current route. */
  activePath: string
  /** Fixed rows above the tree. Omit them and their divider goes too. */
  topLinks?: DocNavTopLink[]
  /** The host's router link. Defaults to a plain `<a href>`. */
  LinkComponent?: DocLinkComponent
  /** Whether the mobile drawer is showing. Controlled — the opener lives in the header. */
  open?: boolean
  /** Called when the reader dismisses the drawer, by backdrop or by button. */
  onClose?: () => void
  /** The drawer's heading. */
  title?: ReactNode
  /** Accessible name for both dismiss targets. */
  closeLabel?: string
}

export function DocNav({
  nodes,
  activePath,
  topLinks = [],
  LinkComponent = DefaultDocLink,
  open = false,
  onClose,
  title = "Navigation",
  closeLabel = "Close navigation",
  className,
  ...rest
}: DocNavProps) {
  // One nav, rendered into both shells. Two copies would be two things to keep
  // in step, and the drawer is the one nobody checks.
  const nav = (
    <nav className={DOC_NAV_NAV_CLASS}>
      {topLinks.map((link) => (
        <div key={link.href} className="flex flex-col gap-3">
          <h3 className={DOC_NAV_TOP_LINK_CLASS}>
            {activePath === link.href && (
              <span className="absolute -left-6 top-0 bottom-0 w-0.5 bg-[var(--color-accent)]" />
            )}
            <LinkComponent
              to={link.href}
              className="hover:text-[var(--color-accent)]"
            >
              {link.label}
            </LinkComponent>
          </h3>
        </div>
      ))}
      {/* The rule separates the fixed rows from the tree. With no fixed rows
          there is nothing to separate, and it would read as an empty first
          section. */}
      {topLinks.length > 0 && (
        <div className="border-t border-[var(--color-border-subtle)]" />
      )}
      <DocNavTree
        nodes={nodes}
        activePath={activePath}
        LinkComponent={LinkComponent}
      />
    </nav>
  )

  return (
    <>
      <aside className={cn(DOC_NAV_ASIDE_CLASS, className)} {...rest}>
        {nav}
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label={closeLabel}
            className="fixed inset-0 bg-black/50"
            onClick={onClose}
          />
          <aside className={DOC_NAV_DRAWER_CLASS}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-subtle)]">
              <span className="font-mono text-sm font-medium text-[var(--color-text-primary)]">
                {title}
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                className="p-1 text-[var(--color-text-dim)] hover:text-[var(--color-text-primary)]"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </div>
            {nav}
          </aside>
        </div>
      )}
    </>
  )
}
