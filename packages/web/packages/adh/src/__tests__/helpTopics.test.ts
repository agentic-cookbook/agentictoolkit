import { describe, it, expect } from 'vitest'
import {
  HELP_TOPICS,
  buildTopicLevels,
  canonicalSlug,
  flattenTopics,
  topicPathForSlug,
} from '../help/topics'

/** The deepest level the builder emitted — the frontier the reader actually looks at. */
function frontier(path: string[]) {
  const { levels, activeTopic } = buildTopicLevels(path)
  return { level: levels[levels.length - 1]!, activeTopic }
}

describe('buildTopicLevels landing child', () => {
  it('auto-selects the MCP section landing so /mcp reads Overview, not a select nudge', () => {
    const { level, activeTopic } = frontier(topicPathForSlug('mcp') ?? [])
    expect(level.parentId).toBe('mcp')
    expect(level.selectedId).toBe('mcp-overview')
    expect(activeTopic?.contentKey).toBe('mcp-overview')
  })

  it('leaves a section with no landing child on its unselected frontier', () => {
    // Hub declares no landing child, so it keeps the select nudge every other section shows.
    const { level, activeTopic } = frontier(topicPathForSlug('hub') ?? [])
    expect(level.parentId).toBe('hub')
    expect(level.selectedId).toBeNull()
    expect(activeTopic?.id).toBe('hub')
  })

  it('does not override an explicit selection deeper in the section', () => {
    const { level, activeTopic } = frontier(topicPathForSlug('mcp/connect') ?? [])
    expect(level.selectedId).toBe('mcp-connect')
    expect(activeTopic?.id).toBe('mcp-connect')
  })

  it('never leaves the root level auto-selected', () => {
    const { levels, activeTopic } = buildTopicLevels([])
    expect(levels).toHaveLength(1)
    expect(levels[0]!.selectedId).toBeNull()
    expect(activeTopic).toBeNull()
  })

  it('names a real child of its own section wherever a landing child is declared', () => {
    // A landing child that is not actually a child is silently ignored at runtime, so the tree
    // itself is the thing under test — a typo'd id fails here rather than quietly doing nothing.
    for (const topic of flattenTopics(HELP_TOPICS)) {
      if (!topic.landingChildId) continue
      expect(topic.children?.map((c) => c.id), `${topic.id}.landingChildId`).toContain(
        topic.landingChildId,
      )
    }
  })
})

describe('canonicalSlug', () => {
  it('collapses a section landing child onto the section that serves the same page', () => {
    expect(canonicalSlug('mcp/overview')).toBe('mcp')
  })

  it('leaves the section itself, an ordinary topic, and an unknown slug alone', () => {
    expect(canonicalSlug('mcp')).toBe('mcp')
    expect(canonicalSlug('mcp/connect')).toBe('mcp/connect')
    // hub/overview is NOT a landing child — Hub declares none — so it stays its own canonical.
    expect(canonicalSlug('hub/overview')).toBe('hub/overview')
    expect(canonicalSlug('nope/nowhere')).toBe('nope/nowhere')
  })
})
