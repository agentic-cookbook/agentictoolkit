/**
 * The help topic tree — the single declaration of what the help surface offers and how the topics
 * nest. It is the ONE source of truth for both renderings:
 *
 *   - the SSR **help site** (`help.adh.com`), where each topic's {@link HelpTopic.slug} is a real,
 *     crawlable route and the tree renders as a server-rendered HMDV master-detail, and
 *   - the client **Help modal**, mounted on every site, which renders the identical HMDV over the
 *     same tree with in-place selection instead of routing.
 *
 * {@link buildTopicLevels} turns a selection path into the per-depth {@link HierarchicalDetailView}
 * levels + the active topic; each surface supplies its own navigation (route push vs. state) and
 * its own leaf renderer, so the structure lives here exactly once.
 *
 * Adding a topic is data-only: add a node here (and, for a markdown leaf, a `.md` file under
 * `content/` regenerated into `content.generated.ts`). No wiring changes.
 */

/** A stable topic id. Also the deep-link handle passed to `useHelp().open(id)`. */
export type HelpTopicId = string

export interface HelpTopic {
  id: HelpTopicId
  /** Row label + breadcrumb crumb. */
  label: string
  /** Base-relative route slug (NO leading slash), e.g. `quickstart`, `quickstart/oauth/authorize`,
   *  `reference/errors`. The help site generates one SSR route per slug; the slug path mirrors the
   *  id path down the tree. */
  slug: string
  /** One/two-sentence blurb. It renders as the `EmptyState` body when this topic is SELECTED and has
   *  no content of its own (`HelpSurface.tsx:47`, `HelpWindow.tsx:26`). It used to also land an
   *  UNSELECTED level as a grid of one card per sibling; that opt-in is gone
   *  (docs/ui/fleet-ui-audit.md §1.5 — an unselected frontier is the select nudge and nothing else),
   *  so a blurb on a topic nobody has picked yet is now carried but not shown. */
  description?: string
  /** Child topics. Presence opens the children as the next hierarchical level when this node is
   *  selected. A node MAY carry both `children` and its own `contentKey` — then it is a *section*
   *  page: its content fills the detail pane while its children show as the next level. (No topic
   *  uses that combination today; the level builder supports it.) */
  children?: HelpTopic[]
  /** For a section (a node with `children`): the child that stands in as its landing. Selecting the
   *  section — arriving on its slug, or clicking its row in either rail — auto-selects that child,
   *  so the section shows real content instead of the children level's select nudge. Opt-in per
   *  section: a section without it keeps the nudge (docs/ui/fleet-ui-audit.md §1.5). Must name a
   *  direct child; `helpTopics.test.ts` fails on an id that isn't one. */
  landingChildId?: HelpTopicId
  /** Key into `HELP_CONTENT_HTML` (content.generated.ts) — the detail pane renders that pre-rendered
   *  markdown. May coexist with `children` (section page); mutually exclusive with `view`. */
  contentKey?: string
  /** A built-in non-markdown detail view. `api` = the REST API reference (a link-out to the
   *  standalone `/rest-api` reference on the site; the interactive browser in the modal). `chat` =
   *  the assistant chat. Mutually exclusive with `contentKey`. */
  view?: 'api' | 'chat'
}

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: 'chat',
    label: 'Chat',
    slug: 'chat',
    description: 'Ask bitbag anything about building on the Agentic Developer Hub.',
    view: 'chat',
  },
  {
    // Placeholder section: no guide content of its own (the old walkthrough was stale and was
    // removed) — selecting it opens OAuth beneath, so its landing is the children overview, exactly
    // like Reference. Give it a `contentKey` again when a real quickstart guide is written.
    id: 'quickstart',
    label: 'Quickstart',
    slug: 'quickstart',
    description: 'Register an app, get a token, and make your first call.',
    children: [
      {
        id: 'oauth',
        label: 'OAuth',
        slug: 'quickstart/oauth',
        description: 'Authorize on behalf of a user with the OAuth 2.0 flow.',
        children: [
          { id: 'oauth-overview', label: 'Overview', slug: 'quickstart/oauth/overview', description: 'How the flow fits together.', contentKey: 'oauth-overview' },
          { id: 'oauth-register-app', label: 'Register app', slug: 'quickstart/oauth/register-app', description: 'Create OAuth credentials.', contentKey: 'oauth-register-app' },
          { id: 'oauth-authorize', label: 'Authorize', slug: 'quickstart/oauth/authorize', description: 'Send the user to consent.', contentKey: 'oauth-authorize' },
          { id: 'oauth-token-exchange', label: 'Token exchange', slug: 'quickstart/oauth/token-exchange', description: 'Trade the code for tokens.', contentKey: 'oauth-token-exchange' },
          { id: 'oauth-refresh', label: 'Refresh', slug: 'quickstart/oauth/refresh', description: 'Keep the session alive.', contentKey: 'oauth-refresh' },
        ],
      },
    ],
  },
  {
    id: 'reference',
    label: 'Reference',
    slug: 'reference',
    description: 'Error codes, webhooks, and what changed.',
    children: [
      { id: 'errors', label: 'Errors', slug: 'reference/errors', description: 'Error codes and what they mean.', contentKey: 'errors' },
      { id: 'webhooks', label: 'Webhooks', slug: 'reference/webhooks', description: 'Events the hub can push to you.', contentKey: 'webhooks' },
      { id: 'changelog', label: 'Changelog', slug: 'reference/changelog', description: 'Recent API changes.', contentKey: 'changelog' },
    ],
  },
  {
    id: 'rest-api',
    label: 'REST API',
    slug: 'rest-api',
    description: 'Browse every REST endpoint and try calls against your session.',
    view: 'api',
  },
  {
    // A section, not a monolithic page: the old single mcp.md split into per-concern child topics.
    // Unlike Quickstart and Reference it does NOT land on the children's select nudge: /mcp is the
    // published address of the MCP docs (the MCP host's root redirects a browser here, as do three
    // `/docs/mcp` redirects), so arriving there must read as documentation, not as a menu. The
    // `landingChildId` auto-selects Overview — the reader lands on prose with the siblings beside it.
    id: 'mcp',
    label: 'MCP',
    slug: 'mcp',
    description: 'Connect an agent to the hub over the Model Context Protocol.',
    landingChildId: 'mcp-overview',
    children: [
      { id: 'mcp-overview', label: 'Overview', slug: 'mcp/overview', description: 'What the MCP server is, and how it relates to the REST API.', contentKey: 'mcp-overview' },
      { id: 'mcp-connect', label: 'Connect a client', slug: 'mcp/connect', description: 'Point Claude Desktop, Claude Code, Cursor, or the Inspector at the server.', contentKey: 'mcp-connect' },
      { id: 'mcp-tools', label: 'Tools', slug: 'mcp/tools', description: 'Every tool the server exposes, grouped by area.', contentKey: 'mcp-tools' },
      { id: 'mcp-details', label: 'Details', slug: 'mcp/details', description: 'Transport, auth, session, and data-scope facts.', contentKey: 'mcp-details' },
    ],
  },
  {
    // Same split as MCP: the old hub-features.md's H2 sections are now child topics, one per
    // feature area, so /hub lands on the children level's select nudge with those children in the
    // rail beside it — the same landing Quickstart, Reference and MCP get.
    id: 'hub',
    label: 'Hub Features',
    slug: 'hub',
    description: 'What you can do across the Agentic Developer Hub.',
    children: [
      { id: 'hub-overview', label: 'Overview', slug: 'hub/overview', description: 'How workspaces scope everything you do in the Hub.', contentKey: 'hub-overview' },
      { id: 'hub-workspaces', label: 'Workspaces & account', slug: 'hub/workspaces', description: 'Workspaces, settings, members, and API tokens.', contentKey: 'hub-workspaces' },
      { id: 'hub-personas', label: 'Personas', slug: 'hub/personas', description: 'Design, register, and run AI personas.', contentKey: 'hub-personas' },
      { id: 'hub-products', label: 'Products', slug: 'hub/products', description: 'Ecosystems: apps, tokens, customers, flags, and gamification.', contentKey: 'hub-products' },
      { id: 'hub-storage', label: 'Storage & data', slug: 'hub/storage', description: 'Buckets, files, access, and data integrations.', contentKey: 'hub-storage' },
      { id: 'hub-plan', label: 'Plan', slug: 'hub/plan', description: 'Projects, narratives, and research.', contentKey: 'hub-plan' },
      { id: 'hub-teams', label: 'Teams', slug: 'hub/teams', description: 'Member teams, the team registry, and the team builder.', contentKey: 'hub-teams' },
      { id: 'hub-community', label: 'Community & support', slug: 'hub/community', description: 'Discussions, support, news, and messaging.', contentKey: 'hub-community' },
      { id: 'hub-monitoring', label: 'Monitoring', slug: 'hub/monitoring', description: 'Dashboards that watch your sites and endpoints.', contentKey: 'hub-monitoring' },
      { id: 'hub-apis', label: 'APIs & agents', slug: 'hub/apis', description: 'The REST API, MCP, OAuth, and reusable tools.', contentKey: 'hub-apis' },
    ],
  },
]

/** True when the node opens no child level (its detail pane is the frontier). */
export function isLeaf(topic: HelpTopic): boolean {
  return !topic.children || topic.children.length === 0
}

/** True when selecting this node fills the detail pane with its own content/view (a leaf, or a
 *  section page that also has children). */
export function hasDetail(topic: HelpTopic): boolean {
  return topic.contentKey != null || topic.view != null
}

/**
 * The path of nodes from a root topic down to `id`, or `null` if `id` isn't in the tree.
 * `useHelp().open(id)` uses this to open the modal already navigated to a nested topic.
 */
export function findTopicPath(id: HelpTopicId, topics: HelpTopic[] = HELP_TOPICS): HelpTopic[] | null {
  for (const topic of topics) {
    if (topic.id === id) return [topic]
    if (topic.children) {
      const deeper = findTopicPath(id, topic.children)
      if (deeper) return [topic, ...deeper]
    }
  }
  return null
}

/** Every topic in the tree, depth-first — the enumerable set the site prerenders and the modal lists. */
export function flattenTopics(topics: HelpTopic[] = HELP_TOPICS): HelpTopic[] {
  return topics.flatMap((t) => [t, ...(t.children ? flattenTopics(t.children) : [])])
}

/** Every base-relative slug in the tree — the SSR routes the help site generates. */
export function helpSlugs(): string[] {
  return flattenTopics().map((t) => t.slug)
}

/** The topic whose {@link HelpTopic.slug} equals `slug`, or `undefined`. */
export function topicBySlug(slug: string): HelpTopic | undefined {
  return flattenTopics().find((t) => t.slug === slug)
}

/**
 * The slug that should carry the canonical URL for `slug`. A section's {@link HelpTopic.landingChildId}
 * renders the identical page as the section itself (the section auto-selects it), so the two routes
 * are one document: the SECTION wins, because it is the published address others link to. Every
 * other slug — and an unknown one — is its own canonical.
 */
export function canonicalSlug(slug: string): string {
  const topic = topicBySlug(slug)
  if (!topic) return slug
  const section = flattenTopics().find(
    (t) => t.landingChildId === topic.id && (t.children ?? []).some((c) => c.id === topic.id),
  )
  return section ? section.slug : slug
}

/** The selection path (topic ids, root → leaf) for a base-relative slug, or `null` if unknown. */
export function topicPathForSlug(slug: string): HelpTopicId[] | null {
  const topic = topicBySlug(slug)
  if (!topic) return null
  const path = findTopicPath(topic.id)
  return path ? path.map((t) => t.id) : null
}

/** One hierarchical level's data: its rows, its title, and which row (if any) is selected. Navigation
 *  is intentionally absent — each surface (site route push, modal state) supplies its own handlers. */
export interface TopicLevelData {
  /** The parent topic id whose children this level lists, or `null` at the root. */
  parentId: HelpTopicId | null
  /** The level heading (parent label, or `Help` at the root). */
  title: string
  items: { id: HelpTopicId; label: string; description?: string; slug: string }[]
  selectedId: HelpTopicId | null
}

/**
 * Walk a selection `path` (topic ids, root → deepest) down {@link HELP_TOPICS}, emitting one
 * {@link TopicLevelData} per depth (each level's selection scopes the next) plus the deepest selected
 * topic — the one whose content/view fills the detail pane. A selected node with both content and
 * children contributes BOTH: its content is the `activeTopic`, and its children form the next level.
 *
 * Where the path runs out on a section that declares a {@link HelpTopic.landingChildId}, the walk
 * continues into that child instead of stopping on an unselected frontier — so both surfaces (the
 * SSR route and the modal) land that section on real content from the one declaration here. The
 * root level never auto-selects: it has no parent section to declare a landing.
 */
export function buildTopicLevels(path: HelpTopicId[]): { levels: TopicLevelData[]; activeTopic: HelpTopic | null } {
  const levels: TopicLevelData[] = []
  let siblings: HelpTopic[] = HELP_TOPICS
  let title = 'Help'
  let parentId: HelpTopicId | null = null
  /** The enclosing section's landing child, if it declared one — `undefined` at the root, which is
   *  why the root level never auto-selects. Carried alongside `siblings` rather than read off a
   *  `parent` topic: that reference would close a type circle back through `node` (TS7022). */
  let landing: HelpTopicId | undefined
  let activeTopic: HelpTopic | null = null

  for (let depth = 0; ; depth++) {
    const selId: HelpTopicId | null =
      path[depth] ?? (landing != null && siblings.some((t) => t.id === landing) ? landing : null)
    levels.push({
      parentId,
      title,
      items: siblings.map((t) => ({ id: t.id, label: t.label, description: t.description, slug: t.slug })),
      selectedId: selId,
    })
    if (selId == null) break
    const node = siblings.find((t) => t.id === selId) ?? null
    if (!node) break
    activeTopic = node
    if (node.children && node.children.length > 0) {
      siblings = node.children
      title = node.label
      parentId = node.id
      landing = node.landingChildId
      continue
    }
    break
  }

  return { levels, activeTopic }
}
