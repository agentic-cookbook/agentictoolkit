'use client'

import { useMemo, type ReactNode } from 'react'
import type { TopicLevel } from '@agentic-toolkit/ui/blocks'
import { HierarchicalDetailView } from '@agentic-toolkit/ui/blocks'
import { EmptyState } from '@agentic-toolkit/ui/components/empty-state'
import { FloatingWindow } from '@agentic-toolkit/adh/debug-env'
import { buildTopicLevels, type HelpTopic } from './topics'
import { topicIcon } from './topic-icons'
import { MarkdownTopic } from './views/MarkdownTopic'
import { ApiTopic } from './views/ApiTopic'
import { ChatTopic } from './views/ChatTopic'

/** The detail pane for the deepest selected topic, chosen by its `view`/`contentKey`. A node that
 *  has content AND children (a section page like Quickstart) still renders its content here — its
 *  children open as the next level. A pure branch with no content shows its blurb. */
function topicView(topic: HelpTopic | null): ReactNode {
  if (!topic) {
    return (
      <EmptyState className="m-4" title="No topic selected" description="Choose a help topic to get started." />
    )
  }
  if (topic.view === 'api') return <ApiTopic />
  if (topic.view === 'chat') return <ChatTopic />
  if (topic.contentKey) return <MarkdownTopic contentKey={topic.contentKey} />
  return <EmptyState className="m-4" title={topic.label} description={topic.description ?? 'Choose a subtopic.'} />
}

/**
 * The Help modal — a backdrop-less, draggable {@link FloatingWindow} (the same shell as the debug
 * console) whose {@link HierarchicalDetailView} navigates {@link buildTopicLevels}. It shares the
 * exact topic tree + level builder with the SSR help site (the standalone site is the same HMDV,
 * server-rendered), so the modal and the site stay in lockstep. Fully controlled: the caller
 * ({@link HelpProvider}) owns `open` and the selection `path` (the chosen topic id at each depth),
 * so deep-links and Back-navigation share one source of truth.
 */
export function HelpWindow({
  open,
  onClose,
  path,
  onPathChange,
}: {
  open: boolean
  onClose: () => void
  path: string[]
  onPathChange: (path: string[]) => void
}) {
  const { levels, leaf } = useMemo(() => {
    const { levels: data, activeTopic } = buildTopicLevels(path)
    const tlevels: TopicLevel[] = data.map((level, depth) => ({
      id: level.parentId == null ? 'help-root' : `help:${level.parentId}`,
      title: level.title,
      // Same topic glyphs as the SSR site rail (topicIcon by topic id), so the modal and the
      // standalone help site stay in lockstep down to the row icons — never HMDV's neutral ring.
      items: level.items.map((it) => ({
        id: it.id,
        label: it.label,
        description: it.description,
        icon: topicIcon(it.id),
      })),
      selectedId: level.selectedId,
      // Select at this depth → replace this level's choice and clear everything deeper.
      onSelect: (id: string) => onPathChange([...path.slice(0, depth), id]),
      // Clear this level and below (re-click, breadcrumb up, Back).
      onClear: () => onPathChange(path.slice(0, depth)),
    }))
    return { levels: tlevels, leaf: topicView(activeTopic) }
  }, [path, onPathChange])

  return (
    <FloatingWindow open={open} onClose={onClose} title="Help">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <HierarchicalDetailView
          levels={levels}
          rootLabel="Help"
          disclosureStyle="cascading"
          autoHideTopics
          exitGuard={null}
        >
          {leaf}
        </HierarchicalDetailView>
      </div>
    </FloatingWindow>
  )
}
