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
import { useCallback, useState } from "react"
import { ChevronRight, X } from "lucide-react"

import { cn } from "../lib/utils"
import { DefaultDocLink } from "./doc-link"
import type { DocLinkComponent, DocNavTopLink, HdvNavNode } from "./doc-types"

/** The desktop column: sticky under the header, scrolling on its own.
 *
 *  The offset is `var(--adh-header-height, 3.5rem)` rather than a literal, because the
 *  adh header is no longer one bar: it is a bar plus a full-width preview strip above
 *  it, and the variable is where that sum lives. The 3.5rem fallback is the bar alone,
 *  for the consumers of this package that mount no adh header at all.
 *
 *  It was `w-80` (20rem), and at that width a document tree wraps: on the cookbook's
 *  492 rows — 24px of nav padding a side, 14px of indent per level, ~7px a character
 *  at `text-sm` — 80 of them ran past the column and took a second line, which in a
 *  tree reads as two entries rather than one. `w-96` clears all but 28 of them, and
 *  `xl:w-[32rem]` clears all but ONE (an 84-character appendix title; the next longest
 *  is 60). Two steps rather than one because the wide value is only affordable once
 *  there is a viewport to spend: 32rem is 40% of an `xl` screen but half of an `lg`
 *  one, and a nav that takes half the window has stopped being a sidebar.
 *
 *  The guarantee itself is `DOC_NAV_DESKTOP_NAV_CLASS` below, not these widths — no
 *  width can be correct for every theme, because `--font-sans` is a theme token and
 *  the family swaps under it. */
export const DOC_NAV_ASIDE_CLASS =
  "hidden lg:block w-96 xl:w-[32rem] shrink-0 border-r border-[var(--color-border-subtle)] overflow-y-auto sticky top-[var(--adh-header-height,3.5rem)] h-[calc(100vh-var(--adh-header-height,3.5rem))]"

/** The nav element itself, shared verbatim by the aside and the drawer. */
export const DOC_NAV_NAV_CLASS =
  "flex flex-col gap-6 px-6 py-6 overflow-y-auto h-full"

/** What the DESKTOP column adds, and the drawer deliberately does not.
 *
 *  `white-space` is inherited, so one declaration on the `nav` covers every row at
 *  every depth — that is what makes "no entry wraps" a property of the column rather
 *  than a class each of the five row styles has to remember. Anything still too long
 *  for the width scrolls instead, which is why `overflow-x` comes with it.
 *
 *  The drawer is left wrapping on purpose. It is the phone's navigation, where there
 *  is no width to widen to, and a row that wraps onto a second line is a better
 *  answer there than a row you have to drag sideways to finish reading. */
export const DOC_NAV_DESKTOP_NAV_CLASS = "whitespace-nowrap overflow-x-auto"

/** The slide-over's viewport: everything below the header, and nothing above it.
 *  It used to be `fixed inset-0 z-50`, which is the same z-index the shared header
 *  carries — so with equal specificity the header's own stacking lost to DOM order
 *  and the drawer painted straight over it, burying the very control you had just
 *  pressed. Starting below the header instead of restacking is what makes that
 *  unrepresentable rather than merely fixed: the two boxes no longer overlap, so no
 *  future z-index change can put them back in contention. `z-40` then keeps the
 *  header above the scrim by declaration, not by luck. The offset is the same
 *  `var(--adh-header-height, 3.5rem)` DOC_NAV_ASIDE_CLASS uses — one header height,
 *  read from the header rather than copied from it. */
export const DOC_NAV_OVERLAY_CLASS =
  "fixed top-[var(--adh-header-height,3.5rem)] right-0 bottom-0 left-0 z-40"

/** The scrim. `absolute`, so it fills the overlay above rather than the
 *  viewport — a `fixed inset-0` here would reach back up over the header. */
export const DOC_NAV_SCRIM_CLASS = "absolute inset-0 bg-black/50"

/** The slide-over panel itself, filling the overlay's height. */
export const DOC_NAV_DRAWER_CLASS =
  "absolute inset-y-0 left-0 w-72 bg-[var(--color-surface)] shadow-xl overflow-y-auto"

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
function NavHeadings({ node, activePath, LinkComponent }: LevelProps) {
  const headings = node.headings ?? []
  if (headings.length === 0) return null

  const onPage = activePath === node.href

  return (
    <ul className={DOC_NAV_BRANCH_LIST_CLASS}>
      {headings.map((heading) => {
        const href = `${node.href}#${heading.id}`
        return (
          <li key={heading.id}>
            {/* The host's link, not a bare anchor. On the page it points at
                there is nothing to navigate, so the handler below scrolls and
                writes the hash — but from ANY OTHER page this row is a real
                navigation, and a plain `<a href>` would take the whole document
                down with it: a full load, this nav remounted, and every section
                the reader had opened shut again. */}
            <LinkComponent
              to={href}
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
            </LinkComponent>
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
      <NavHeadings
        node={node}
        activePath={activePath}
        LinkComponent={LinkComponent}
      />
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

/** True when `activePath` is this node's own page or any page beneath it. */
const isWithin = (activePath: string, node: HdvNavNode) =>
  activePath === node.href || activePath.startsWith(node.href + "/")

/**
 * Which top-level sections are open, and how to flip one.
 *
 * Seeded from `activePath` ONCE, at mount, and the reader's from then on —
 * re-deriving it on every route change would slam a section shut under someone
 * who had just opened it to browse.
 */
function useExpandedSections(nodes: HdvNavNode[], activePath: string) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        nodes.filter((node) => isWithin(activePath, node)).map((n) => n.href),
      ),
  )

  const toggle = useCallback((href: string) => {
    setExpanded((previous) => {
      const next = new Set(previous)
      // `delete` reports whether it was there, which is the whole test.
      if (!next.delete(href)) next.add(href)
      return next
    })
  }, [])

  return { expanded, toggle }
}

/**
 * A top-level section: the one level that collapses.
 *
 * Its open state is passed in rather than held here — see `DocNavTree`.
 */
function NavSection({
  node,
  activePath,
  LinkComponent,
  expanded,
  onToggle,
}: LevelProps & { expanded: boolean; onToggle: () => void }) {
  const selected = activePath === node.href

  return (
    <div className="flex flex-col gap-1">
      <div className="relative flex items-center gap-1">
        <button
          type="button"
          onClick={onToggle}
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

/**
 * A fixed row: a section's type and accent, with no contents and no control.
 *
 * The same component draws `topLinks` and `bottomLinks`, so a host cannot end up
 * with two kinds of fixed row that read differently depending on which end of the
 * nav they were passed to.
 */
function NavFixedLink({
  link,
  activePath,
  LinkComponent,
}: {
  link: DocNavTopLink
  activePath: string
  LinkComponent: DocLinkComponent
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className={DOC_NAV_TOP_LINK_CLASS}>
        {activePath === link.href && (
          <span className="absolute -left-6 top-0 bottom-0 w-0.5 bg-[var(--color-accent)]" />
        )}
        <LinkComponent to={link.href} className="hover:text-[var(--color-accent)]">
          {link.label}
        </LinkComponent>
      </h3>
    </div>
  )
}

/** The rule that separates the fixed rows from the tree. */
function NavDivider() {
  return <div className="border-t border-[var(--color-border-subtle)]" />
}

export interface DocNavTreeProps {
  /** Top-level sections, in the order they should appear. */
  nodes: HdvNavNode[]
  /** The current route. A prop, never a router subscription — see doc-types.ts. */
  activePath: string
  /** The host's router link. Defaults to a plain `<a href>`. */
  LinkComponent?: DocLinkComponent
  /**
   * Which sections are open, by `href`. Omit it and the tree owns the state
   * itself, which is what a single-shell host wants.
   *
   * `DocNav` supplies it because it renders one nav into TWO shells — a desktop
   * column and a mobile drawer. Those are two React instances of this component,
   * so per-instance state would let the two disagree, and the drawer's copy
   * would be discarded every time it closed.
   */
  expandedSections?: ReadonlySet<string>
  /** Called with a section's `href` when its control is used. Pass it with `expandedSections`. */
  onToggleSection?: (href: string) => void
}

export function DocNavTree({
  nodes,
  activePath,
  LinkComponent = DefaultDocLink,
  expandedSections,
  onToggleSection,
}: DocNavTreeProps) {
  const own = useExpandedSections(nodes, activePath)
  const expanded = expandedSections ?? own.expanded
  const toggle = onToggleSection ?? own.toggle

  return (
    <>
      {nodes.map((node) => (
        <NavSection
          key={node.href}
          node={node}
          activePath={activePath}
          LinkComponent={LinkComponent}
          expanded={expanded.has(node.href)}
          onToggle={() => toggle(node.href)}
        />
      ))}
    </>
  )
}

/**
 * `className` and any other DOM attribute land on the DESKTOP column, which is
 * the element a host is styling or naming when it reaches for them. They are
 * deliberately not copied onto the drawer: that column is `hidden lg:block`, so
 * it stays in the DOM at every width, and spreading an `id` onto both shells
 * would put a duplicate id in the document whenever the drawer was open.
 */
export interface DocNavProps
  extends Omit<HTMLAttributes<HTMLElement>, "children" | "title"> {
  /** Top-level sections of the document tree. */
  nodes: HdvNavNode[]
  /** The current route. */
  activePath: string
  /** Fixed rows above the tree. Omit them and their divider goes too. */
  topLinks?: DocNavTopLink[]
  /**
   * Fixed rows BELOW the tree, behind a divider of their own.
   *
   * The mirror of `topLinks`, and separate from it rather than a position flag on
   * one list, because the divider is not the same rule: above the tree it closes
   * the fixed rows, below it opens them. A host that wants a row at each end
   * passes both and gets both rules; a host that wants neither passes neither and
   * gets an undivided tree.
   */
  bottomLinks?: DocNavTopLink[]
  /** The host's router link. Defaults to a plain `<a href>`. */
  LinkComponent?: DocLinkComponent
  /** Whether the mobile drawer is showing. Controlled — the opener lives in the header. */
  open?: boolean
  /** Called when the reader dismisses the drawer, by backdrop or by button. */
  onClose?: () => void
  /** The drawer's heading. */
  title?: ReactNode
  /** Accessible name for the drawer's dismiss button. */
  closeLabel?: string
}

export function DocNav({
  nodes,
  activePath,
  topLinks = [],
  bottomLinks = [],
  LinkComponent = DefaultDocLink,
  open = false,
  onClose,
  title = "Navigation",
  closeLabel = "Close navigation",
  className,
  ...rest
}: DocNavProps) {
  // The tree's open/closed state lives HERE, above both shells, because `nav`
  // below is one element DESCRIPTION rendered at two positions — and React makes
  // that two component instances, not one element in two places. Held inside the
  // tree it would be per-instance: the drawer and the desktop column would drift
  // apart, and the drawer's copy would be destroyed by the `open &&` unmount
  // every time the reader closed it, so mobile expansions would never survive.
  const { expanded, toggle } = useExpandedSections(nodes, activePath)

  // A function rather than one element, because the two shells no longer render
  // the same nav: the desktop column adds `DOC_NAV_DESKTOP_NAV_CLASS` and the
  // drawer does not. Everything inside is still one description, so the two can
  // only differ in what is passed here.
  const navFor = (extra?: string) => (
    <nav className={cn(DOC_NAV_NAV_CLASS, extra)}>
      {topLinks.map((link) => (
        <NavFixedLink
          key={link.href}
          link={link}
          activePath={activePath}
          LinkComponent={LinkComponent}
        />
      ))}
      {/* The rule separates the fixed rows from the tree. With no fixed rows
          there is nothing to separate, and it would read as an empty first
          section. */}
      {topLinks.length > 0 && <NavDivider />}
      <DocNavTree
        nodes={nodes}
        activePath={activePath}
        LinkComponent={LinkComponent}
        expandedSections={expanded}
        onToggleSection={toggle}
      />
      {/* And the same rule on the other side, for the same reason: with no rows
          below it, it would draw a line under the last section and close nothing. */}
      {bottomLinks.length > 0 && <NavDivider />}
      {bottomLinks.map((link) => (
        <NavFixedLink
          key={link.href}
          link={link}
          activePath={activePath}
          LinkComponent={LinkComponent}
        />
      ))}
    </nav>
  )

  return (
    <>
      <aside className={cn(DOC_NAV_ASIDE_CLASS, className)} {...rest}>
        {navFor(DOC_NAV_DESKTOP_NAV_CLASS)}
      </aside>

      {open && (
        <div className={DOC_NAV_OVERLAY_CLASS}>
          {/* A scrim, not a control. It dismisses on click for a pointer user,
              but it is neither focusable nor announced: a full-screen <button>
              is read out as a button covering the whole page, and — carrying
              `closeLabel` as well — as a SECOND control with the same name as
              the X. The X is the keyboard and screen-reader path. */}
          <div
            aria-hidden="true"
            className={DOC_NAV_SCRIM_CLASS}
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
            {navFor()}
          </aside>
        </div>
      )}
    </>
  )
}
