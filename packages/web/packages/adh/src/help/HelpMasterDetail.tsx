'use client'

import { useMemo, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import type { TopicLevel } from '@agentic-toolkit/ui/blocks'
import { HierarchicalDetailView } from '@agentic-toolkit/ui/blocks'
import { topicIcon } from './topic-icons'

/** One hierarchical level, already resolved to route hrefs by the server ({@link HelpSurface}). The
 *  client only wires the hrefs to the router — it computes no routing itself. */
export interface HelpRouteLevel {
  /** Stable {@link TopicLevel} id / react key. */
  key: string
  title: string
  items: { id: string; label: string; description?: string; href: string }[]
  selectedId: string | null
  /** Where re-clicking the selected row / navigating "up" from this level goes. */
  clearHref: string
}

/**
 * The client half of the SSR help surface: renders the shared HMDV
 * ({@link HierarchicalDetailView}) over server-computed {@link HelpRouteLevel}s, translating each
 * row selection into a real route navigation (`router.push`). The detail pane (`children`) is the
 * leaf the server already rendered for the active route, so the initial paint is fully server-side;
 * this component only adds the interactive rail. It is the same HMDV the Help modal uses, so the
 * standalone site and the modal look and behave identically.
 */
export function HelpMasterDetail({
  levels,
  rootLabel,
  children,
}: {
  levels: HelpRouteLevel[]
  rootLabel: string
  children: ReactNode
}) {
  const router = useRouter()
  const topicLevels = useMemo<TopicLevel[]>(
    () =>
      levels.map((l) => {
        const hrefById = new Map(l.items.map((it) => [it.id, it.href]))
        return {
          id: l.key,
          title: l.title,
          // topicIcon(it.id) gives every row a topic glyph in place of HMDV's neutral fallback ring —
          // the item id IS the HelpTopic id, so the same map serves the root and every nested level.
          items: l.items.map((it) => ({
            id: it.id,
            label: it.label,
            description: it.description,
            icon: topicIcon(it.id),
          })),
          selectedId: l.selectedId,
          // Every help level IS a topic browser, so its card grid (icon + label + description per
          // row) is the level's real landing page — not a placeholder to nudge past. HMDV's default
          // unselected-frontier detail is the quiet "select something" hint, so each level opts into
          // the cards explicitly.
          overview: 'cards',
          onSelect: (id: string) => {
            const href = hrefById.get(id)
            if (href) router.push(href)
          },
          onClear: () => router.push(l.clearHref),
        }
      }),
    [levels, router],
  )

  return (
    <HierarchicalDetailView
      levels={topicLevels}
      rootLabel={rootLabel}
      disclosureStyle="cascading"
      autoHideTopics
      exitGuard={null}
    >
      {children}
    </HierarchicalDetailView>
  )
}
