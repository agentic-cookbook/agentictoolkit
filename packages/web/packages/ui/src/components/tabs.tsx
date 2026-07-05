"use client"

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"

import { cn } from "../lib/utils"

// Base UI tabs, styled to match hub's /home tab bar: underline-style mono tabs
// with a gold bottom-border on the active tab (not a filled pill). Compose:
//   <Tabs defaultValue="a">
//     <TabsList><TabsTab value="a">A</TabsTab>…</TabsList>
//     <TabsPanel value="a">…</TabsPanel>
//   </Tabs>
function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("flex flex-col gap-5", className)}
      {...props}
    />
  )
}

// The single authoritative underline-mono tab treatment. Active state is keyed
// off a `data-active` attribute so every tab-shaped element shares it: Base UI
// sets it on the active <TabsTab>; nav-style tab bars (AppTabs, link tabs) set
// `data-active` themselves on their <button>/<Link>.
const tabListClass = "flex items-end gap-4 border-b border-apt-border"
const tabItemClass = cn(
  "-mb-px inline-flex items-center gap-1.5 border-b-2 border-transparent px-1 py-2 font-mono text-[0.8rem] tracking-wide text-apt-text-muted transition-colors outline-none",
  "hover:text-apt-text focus-visible:text-apt-text",
  "data-[active]:border-apt-gold data-[active]:text-apt-text",
  "disabled:pointer-events-none disabled:opacity-50",
)

function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(tabListClass, className)}
      {...props}
    />
  )
}

function TabsTab({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-tab"
      className={cn(tabItemClass, className)}
      {...props}
    />
  )
}

function TabsPanel({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-panel"
      className={cn("text-sm text-apt-text-muted outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTab, TabsPanel, tabListClass, tabItemClass }
