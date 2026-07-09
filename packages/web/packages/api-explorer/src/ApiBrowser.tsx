'use client'

import { useState, type ReactNode } from 'react'
import { cn } from '@agentic-toolkit/ui'
import { HierarchicalTopicDetail, type TopicLevel } from '@agentic-toolkit/ui/blocks/hierarchical-topic-detail'
import { allTags, endpointsForTag, getEndpoint, endpointKey as toKey } from './lib/getEndpoint'
import { methodDotClass } from './lib/tone'
import { ApiEndpointDetail } from './ApiEndpointDetail'
import type { EndpointRef } from './types'

export interface ApiBrowserProps {
  /** Focus the browser on this endpoint on open (the rest stays browsable). */
  endpoint?: EndpointRef
  /** Alternative to `endpoint`: the raw map key. */
  endpointKey?: string
  /** Seed path/query params for the focused endpoint (e.g. the id being configured). */
  pathValues?: Record<string, string>
  queryValues?: Record<string, string>
  /** Seed the focused endpoint's request body. */
  body?: string
  apiOrigin?: string
}

function methodDot(method: string): ReactNode {
  return <span aria-hidden className={cn('inline-block size-2 rounded-full', methodDotClass(method))} />
}

/**
 * The full API browser: a hierarchical Tags → Endpoints view of the whole surface,
 * with the selected endpoint's full detail (Overview + disclosable Response / Code /
 * Try it) in the pane. Opens focused on `endpoint` (its tag pre-selected) but every
 * endpoint stays browsable via the rails + breadcrumb. Selecting an endpoint remounts
 * its detail (keyed by key) so try-it state never leaks between endpoints.
 */
export function ApiBrowser({ endpoint, endpointKey, pathValues, queryValues, body, apiOrigin }: ApiBrowserProps) {
  const focusKey = endpointKey ?? (endpoint ? toKey(endpoint) : undefined)
  const focusMeta = focusKey ? getEndpoint(focusKey) : undefined

  // Match getEndpoint's index, which buckets untagged endpoints under 'other'.
  const [tag, setTag] = useState<string | null>(focusMeta ? (focusMeta.tag ?? 'other') : null)
  const [selKey, setSelKey] = useState<string | null>(focusMeta ? focusKey! : null)

  const tags = allTags()
  const endpoints = tag ? endpointsForTag(tag) : []
  const selMeta = selKey ? getEndpoint(selKey) : undefined

  const levels: TopicLevel[] = [
    {
      id: 'tags',
      title: 'Tags',
      items: tags.map((t) => ({ id: t, label: t })),
      selectedId: tag,
      onSelect: (t) => {
        setTag(t)
        setSelKey(null)
      },
      onClear: () => {
        setTag(null)
        setSelKey(null)
      },
    },
    {
      id: 'endpoints',
      title: 'Endpoints',
      // A wider rail fits the full method+path on ONE line — no wrap, no truncation.
      width: 400,
      items: endpoints.map((m) => ({ id: m.key, label: `${m.method} ${m.path}`, icon: methodDot(m.method) })),
      selectedId: selKey,
      emptyLabel: 'Pick a tag to see its endpoints.',
      onSelect: (k) => setSelKey(k),
      onClear: () => setSelKey(null),
    },
  ]

  // Carry the focused endpoint's params ONLY to its own CRUD family (same resource
  // base) so the id prefills GET/PUT/DELETE of that resource — never to an unrelated
  // endpoint that happens to share a param name (which could send a mutation against
  // a leaked id).
  const inFocusFamily = focusKey != null && selMeta != null && selMeta.family.includes(focusKey)
  const detail = selMeta ? (
    <ApiEndpointDetail
      key={selKey!}
      meta={selMeta}
      initialPathValues={inFocusFamily ? pathValues : undefined}
      initialQueryValues={inFocusFamily ? queryValues : undefined}
      initialBody={selKey === focusKey ? body : undefined}
      apiOrigin={apiOrigin}
    />
  ) : (
    <p className="text-sm text-apt-text-muted">{!tag ? 'Choose a tag to browse its endpoints.' : 'Choose an endpoint.'}</p>
  )

  return (
    // HTD's root is flex-1 — it needs a flex parent to fill the modal's height.
    <div className="flex h-full min-h-0 overflow-hidden">
      <HierarchicalTopicDetail
        levels={levels}
        rootLabel="API"
        minDetailWidth="30rem"
        detailTitle={selMeta ? (selMeta.summary ?? `${selMeta.method} ${selMeta.path}`) : undefined}
      >
        {/* HTD's detail pane carries no padding of its own — pad the content here. */}
        <div className="px-4 py-6">{detail}</div>
      </HierarchicalTopicDetail>
    </div>
  )
}
