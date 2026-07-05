"use client"

import type { ReactNode } from "react"

import { cn } from "../lib/utils"
import { tabItemClass, tabListClass } from "../components/tabs"

export interface AppTab {
  id: string
  label: ReactNode
  icon?: ReactNode
}

// The signed-in app's top tab bar — underline-mono tabs with icons, matching
// hub's /home HomeTabs. Controlled: pass `value` + `onValueChange`. An optional
// `endItem` (e.g. User Settings) is pushed to the right edge.
//
// Renders plain buttons (not Base UI <Tabs>) because these are nav-style tabs
// with no panels and an endItem whose active state is independent of `value`;
// the look comes from the shared tab grammar in components/tabs.tsx.
export function AppTabs({
  items,
  value,
  onValueChange,
  endItem,
  className,
}: {
  items: AppTab[]
  value: string
  onValueChange?: (id: string) => void
  endItem?: AppTab & { active?: boolean }
  className?: string
}) {
  const renderTab = (t: AppTab, active: boolean, extra?: string) => (
    <button
      key={t.id}
      type="button"
      role="tab"
      aria-selected={active}
      data-active={active || undefined}
      onClick={() => onValueChange?.(t.id)}
      className={cn(tabItemClass, extra)}
    >
      {t.icon}
      {t.label}
    </button>
  )

  return (
    <div role="tablist" className={cn(tabListClass, className)}>
      {items.map((t) => renderTab(t, t.id === value))}
      {endItem && renderTab(endItem, !!endItem.active, "ml-auto")}
    </div>
  )
}
