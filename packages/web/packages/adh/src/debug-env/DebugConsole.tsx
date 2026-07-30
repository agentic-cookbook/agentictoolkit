'use client'

import { useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { MessagesSquare, Palette, SlidersHorizontal, SquareTerminal } from 'lucide-react'
import type { TopicLevel } from '@agentic-toolkit/ui/blocks'
import { HierarchicalDetailView } from '@agentic-toolkit/ui/blocks'
import { EmptyState } from '@agentic-toolkit/ui/components/empty-state'
import { useThemeEditor } from '@agentic-toolkit/adh/themes'
import { FloatingWindow } from './FloatingWindow'
import { useDebugConsoleConfig } from './DebugConsoleProvider'
import { EnvironmentPanel } from './EnvironmentPanel'
import { SettingsPanel } from './SettingsPanel'
import { buildChatThemeLevel, ChatThemePreview } from './ChatThemePanel'
import { usePersistedSelection } from './selection-store'
import { useSiteThemeBranch } from './SiteThemeBranch'
import type { EnvOverrideSurface, ThemeAreasSurface } from './seams'

type Top = 'environment' | 'settings' | 'site-theme' | 'chat-theme'

const TOP_ITEMS = [
  { id: 'settings', label: 'Settings', icon: <SlidersHorizontal /> },
  { id: 'environment', label: 'Environment', icon: <SquareTerminal /> },
  { id: 'site-theme', label: 'Site theme', icon: <Palette /> },
  { id: 'chat-theme', label: 'Chat theme', icon: <MessagesSquare /> },
] as const

/**
 * The unified Debug console window — a backdrop-less {@link FloatingWindow} whose
 * {@link HierarchicalDetailView} stack hosts every debug topic (Settings / Environment /
 * Site theme / Chat theme), cascading or covered as the platform's hierarchical-view flag
 * decides. Fully controlled: the caller (the shared
 * SiteMenu's "Debug Options" row) owns `open` state and the dev-only/env gating —
 * this component has no trigger of its own and no runtime env check, so it renders
 * whatever the caller decides to show. The caller also INJECTS the two host surfaces
 * this package deliberately does not own: the environment-override store and the theme
 * taxonomy (see `./seams`).
 *
 * The heavy work (theme editor + env fetch) lives in {@link DebugConsoleBody}, which
 * only mounts while the window is open (FloatingWindow returns `null` when closed).
 */
export type DebugConsoleWindowProps = {
  open: boolean
  onClose: () => void
  /** The host's environment-override store — see {@link EnvOverrideSurface}. */
  envOverride: EnvOverrideSurface
  /** The host's theme taxonomy + CSS editor — see {@link ThemeAreasSurface}. */
  themeAreas: ThemeAreasSurface
}

export function DebugConsoleWindow({
  open,
  onClose,
  envOverride,
  themeAreas,
}: DebugConsoleWindowProps) {
  // The window's close action, owned by the body so a dirty Site-theme draft can guard it
  // (set via effect below). Defaults to the caller's plain close for the window's own
  // Escape/× before the body has mounted.
  const closeRef = useRef<() => void>(onClose)
  closeRef.current = onClose

  return (
    <FloatingWindow open={open} onClose={() => closeRef.current()} title="Debug Options">
      <DebugConsoleBody
        onClose={onClose}
        closeRef={closeRef}
        envOverride={envOverride}
        themeAreas={themeAreas}
      />
    </FloatingWindow>
  )
}

/** Rendered only while the window is open (FloatingWindow returns null when closed), so the
 *  theme fetch / env fetch stay lazy. */
function DebugConsoleBody({
  onClose,
  closeRef,
  envOverride,
  themeAreas,
}: {
  onClose: () => void
  closeRef: RefObject<() => void>
  envOverride: EnvOverrideSurface
  themeAreas: ThemeAreasSurface
}) {
  const config = useDebugConsoleConfig()

  // Available root topics: chat-theme only when the host injected a config.
  const rootItems = TOP_ITEMS.filter((t) => t.id !== 'chat-theme' || config.chatTheme != null)

  // Nullable, and it MUST stay that way: the root topic is a real level of the stack, so it has to
  // be clearable like any other. In NARROW mode the visible pane is the deepest one the selection
  // reaches — a permanently-selected root means the detail is always the top pane, the topic list
  // sits inert behind it, and Back (which pops by clearing the deepest selected level) has nothing
  // to clear. Restored from the last time the window was shown; Environment on a first visit, as
  // the wide layout always has. Validated against `rootItems`, so a stored `chat-theme` on a host
  // that no longer injects a chat config falls back rather than selecting a topic that isn't there.
  const [top, setTop] = usePersistedSelection<Top>(
    'top',
    (id) => rootItems.some((t) => t.id === id),
    'environment',
  )
  const ed = useThemeEditor()
  const site = useSiteThemeBranch(ed, themeAreas)

  // Leaving Site theme with a dirty draft prompts (via the branch's guard).
  const setTopGuarded = (next: Top | null) => {
    if (top === 'site-theme' && ed.dirty) site.guardLeave(() => setTop(next))
    else setTop(next)
  }

  // Route the window's close (Escape / × / onClose) through the same theme guard: closing
  // a dirty Site-theme draft prompts (save / discard / stay) before the window disappears.
  useEffect(() => {
    closeRef.current = () =>
      top === 'site-theme' && ed.dirty ? site.guardLeave(() => onClose()) : onClose()
  }, [top, ed.dirty, site, onClose, closeRef])

  const rootLevel: TopicLevel = {
    id: 'root',
    // A titled header — like every other level — so this first list reserves the same header
    // height and its rows align with Themes/Areas, reading as the HTD's first column rather than
    // a bare flat list floating above the others. (Matches the breadcrumb's "Debug Options" root.)
    title: 'Debug Options',
    items: rootItems.map((t) => ({ id: t.id, label: t.label, icon: t.icon })),
    selectedId: top,
    onSelect: (id) => setTopGuarded(id as Top),
    // Deselect the topic — the same clear the breadcrumb root, a re-click, and (in narrow mode)
    // Back all route through. Guarded, so a dirty Site-theme draft still prompts first.
    onClear: () => setTopGuarded(null),
  }

  let levels: TopicLevel[] = [rootLevel]
  // No topic chosen (the console was opened fresh and cleared, or Back popped the last one): the
  // detail pane shows the hint, exactly as every other stack does with an unselected leaf.
  let leaf: ReactNode = (
    <EmptyState
      className="m-4"
      title="No topic selected"
      description="Choose a debug topic to inspect."
    />
  )
  if (top === 'environment') {
    leaf = <EnvironmentPanel />
  } else if (top === 'settings') {
    leaf = <SettingsPanel envOverride={envOverride} />
  } else if (top === 'site-theme') {
    levels = [rootLevel, ...site.levels]
    leaf = site.leaf
  } else if (top === 'chat-theme' && config.chatTheme) {
    levels = [rootLevel, buildChatThemeLevel(config.chatTheme)]
    leaf = <ChatThemePreview chat={config.chatTheme} />
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <HierarchicalDetailView
        levels={levels}
        rootLabel="Debug Options"
        disclosureStyle="cascading"
        exitGuard={null}
      >
        {leaf}
      </HierarchicalDetailView>
      {site.prompt}
    </div>
  )
}
