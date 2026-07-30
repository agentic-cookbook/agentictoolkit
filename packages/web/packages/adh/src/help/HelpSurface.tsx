// NO "use client" — a server component. It resolves the active route to a topic, server-renders the
// leaf (pre-rendered markdown HTML, the chat island slot, or a section empty state), and hands the
// level structure + leaf to the client {@link HelpMasterDetail} for the interactive rail.
// The content is therefore in the SSR HTML (crawlable, no client fetch); only the rail hydrates.

import type { ReactNode } from 'react'
import { EmptyState } from '@agentic-toolkit/ui/components/empty-state'
import { MarkdownHtml } from '../docs/MarkdownHtml'
import { getDocHtmlByKey } from '../docs/content'
import {
  buildTopicLevels,
  findTopicPath,
  topicPathForSlug,
  type HelpTopic,
} from './topics'
// Package path (not './HelpMasterDetail') so the 'use client' rail stays its OWN preserved chunk and
// its directive can't be hoisted over this server module — the same isolation trick as this
// package's themes/DbThemeApplier, which keeps server.ts a plain server module (see
// tsup.config.ts `external`).
import { HelpMasterDetail, type HelpRouteLevel } from '@agentic-toolkit/adh/help/HelpMasterDetail'

/** Join a site `basePath` (no trailing slash; `''` or `/` = apex) with a base-relative slug. */
export function helpHref(basePath: string, slug: string): string {
  const base = basePath === '/' ? '' : basePath
  return slug === '' ? base || '/' : `${base}/${slug}`
}

/** The detail pane for the active topic: its pre-rendered markdown, the injected chat island, or —
 *  for a pure branch (children but no content of its own) — the SAME label/description empty state
 *  the modal's `topicView` renders, so the standalone site and the Help modal match for every node.
 *  (`view: 'api'` topics own their own `/rest-api` route and never reach this renderer.) */
function renderLeaf(topic: HelpTopic | null, chatSlot: ReactNode): ReactNode {
  if (!topic) {
    return <EmptyState className="m-4" title="Help" description="Choose a topic to get started." />
  }
  if (topic.view === 'chat') {
    return <div className="adh-help-topic adh-help-topic--chat">{chatSlot}</div>
  }
  // A pure branch (a section that opens children but carries no content of its own, e.g. Reference or
  // Quickstart › OAuth) shows the same empty state the modal renders — NOT a misleading "no content"
  // dead-end — so the two surfaces stay in lockstep on a crawlable, sitemap-listed route.
  if (!topic.contentKey) {
    return (
      <EmptyState
        className="m-4"
        title={topic.label}
        description={topic.description ?? 'Choose a subtopic.'}
      />
    )
  }
  const html = getDocHtmlByKey(topic.contentKey)
  return (
    <div className="adh-help-topic adh-help-topic--markdown">
      {html == null ? (
        <p className="adh-help-topic__missing">This topic has no content yet.</p>
      ) : (
        <MarkdownHtml html={html} />
      )}
    </div>
  )
}

/**
 * The server-rendered help master-detail for one route. `slug` is the active base-relative slug
 * (e.g. `quickstart`, `quickstart/oauth/authorize`, `reference/errors`); `basePath` is where the
 * surface is mounted (`''` on the help site). `chatSlot` is the client chat island the host app
 * supplies for the `chat` topic (kept in the app so its backend wiring stays out of the shared pkg).
 */
export function HelpSurface({
  slug,
  basePath = '',
  chatSlot,
  rootClearHref,
}: {
  slug: string
  basePath?: string
  chatSlot?: ReactNode
  /** Where clearing the ROOT level's selection navigates — the HMDV's own home. Defaults to the
   *  surface apex; a host whose apex is NOT the surface (the help site's `/` is a landing page,
   *  its HMDV root lives at `/home`) passes that route so unselecting everything stays on the
   *  surface instead of bouncing to the landing. */
  rootClearHref?: string
}) {
  const path = topicPathForSlug(slug) ?? []
  const { levels, activeTopic } = buildTopicLevels(path)
  const pathTopics = activeTopic ? findTopicPath(activeTopic.id) ?? [] : []

  const routeLevels: HelpRouteLevel[] = levels.map((level, depth) => ({
    key: level.parentId == null ? 'help-root' : `help:${level.parentId}`,
    title: level.title,
    items: level.items.map((it) => ({
      id: it.id,
      label: it.label,
      description: it.description,
      href: helpHref(basePath, it.slug),
    })),
    selectedId: level.selectedId,
    // Level 0 clears to the surface's home (`rootClearHref`, defaulting to the apex); a nested
    // level clears up to its parent section's route (the topic one step up the active path).
    clearHref:
      depth === 0
        ? rootClearHref ?? helpHref(basePath, '')
        : helpHref(basePath, pathTopics[depth - 1]?.slug ?? ''),
  }))

  return (
    <HelpMasterDetail levels={routeLevels} rootLabel="Help">
      {renderLeaf(activeTopic, chatSlot)}
    </HelpMasterDetail>
  )
}
