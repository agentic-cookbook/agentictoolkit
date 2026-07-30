// NO "use client" — the SERVER entry for the help surface. The SSR help site imports the surface
// component AND the topic-tree helpers it needs for routing (generateStaticParams, metadata,
// slug↔path) from here, so a server component never has to reach through the client `./index` barrel
// (which is 'use client'). The topic data is pure, so inlining a copy into this chunk is harmless
// (unlike the HelpContext, which must stay a single instance — see tsup.config.ts).

export { HelpSurface, helpHref } from './HelpSurface'
export type { HelpRouteLevel } from './HelpMasterDetail'
// The per-topic row glyph, shared with both HMDV rails — re-exported here so the hub-help REST API
// route (a server component consuming this same barrel) gives its root rows the identical icons.
export { topicIcon } from './topic-icons'
export {
  HELP_TOPICS,
  buildTopicLevels,
  findTopicPath,
  flattenTopics,
  hasDetail,
  helpSlugs,
  isLeaf,
  topicBySlug,
  topicPathForSlug,
} from './topics'
export type { HelpTopic, HelpTopicId, TopicLevelData } from './topics'
