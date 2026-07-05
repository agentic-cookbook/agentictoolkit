"use client"

import type { ReactNode } from "react"

import { tabListClass, tabItemClass } from "../components/tabs"
import { cn } from "../lib/utils"

export interface ViewTabItem {
  value: string
  label: ReactNode
  /** aria-label/title when the visible label is an icon. */
  title?: string
}

export interface ViewTabLink {
  href: string
  label: ReactNode
  active?: boolean
}

/**
 * A content-area tab strip for switching top-level views that are CLIENT STATE
 * (buttons, not routes — an unsaved Config draft must survive a switch), plus
 * optional route links rendered as visually identical tabs (e.g. status's
 * "Fleet", a real page). Styling matches the shared Tabs underline idiom (mono
 * labels, gold bottom border on the active tab, via the exported `tabItemClass`)
 * so boards that mix this strip with <Tabs> panels read as one system.
 *
 * ARIA: the visual strip is a plain flex row. The client-state buttons (when any)
 * live in an inner `role="tablist"`; the route links live in a sibling
 * `<nav aria-label="views">`, never inside the tablist (a link is not a `tab`).
 * When there are no `tabs` at all, no tablist is rendered (a tablist with zero
 * tabs is invalid). Each inner group is itself a `flex items-end gap-4` row, and
 * the strip is too — so the spacing between every tab and link (and between the
 * two groups) is a uniform `gap-4`, visually identical to a single flat row.
 */
export function ViewTabBar({
  tabs,
  value,
  onChange,
  links = [],
  className,
}: {
  tabs: ViewTabItem[]
  value: string
  onChange: (value: string) => void
  links?: ViewTabLink[]
  className?: string
}) {
  return (
    <div className={cn(tabListClass, "px-4", className)}>
      {tabs.length > 0 && (
        <div role="tablist" className="flex items-end gap-4">
          {tabs.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              className={tabItemClass}
              data-active={value === t.value ? "" : undefined}
              aria-selected={value === t.value}
              aria-label={t.title}
              title={t.title}
              onClick={() => onChange(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      {links.length > 0 && (
        <nav aria-label="views" className="flex items-end gap-4">
          {links.map((l, i) => (
            <a
              key={i}
              href={l.href}
              className={tabItemClass}
              data-active={l.active ? "" : undefined}
              aria-current={l.active ? "page" : undefined}
            >
              {l.label}
            </a>
          ))}
        </nav>
      )}
    </div>
  )
}
