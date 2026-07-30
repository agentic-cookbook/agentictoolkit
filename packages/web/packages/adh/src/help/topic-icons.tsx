// Per-topic leading glyph for the help topic rows, shared by ALL renderings of the ONE topic tree:
// the SSR help site rail ({@link HelpMasterDetail}), the Help modal on every site
// ({@link HelpWindow}), and the REST API route's own root rail (hub-help's ApiHelpSurface). It
// replaces the toolkit HMDV's neutral fallback ring (lucide `Circle` — an empty circle that says
// nothing about the topic) with a glyph that reads as the topic, so no help row is a meaningless
// ring. Keyed by the stable {@link HelpTopic.id}; any id not mapped here (a future topic) falls back
// to a document glyph, never the ring.
//
// No explicit color: each glyph inherits the row's `currentColor` and tints with the label on
// selection, exactly like a normal HMDV topic icon (and the REST API area glyphs) — so a selected
// row's icon goes gold with its label. `size={16}` matches the ring it replaces (the toolkit also
// force-sizes rail svgs to 16px).
//
// This module carries NO directive on purpose: with tsup `splitting:false` it inlines into each
// importing entry (the two 'use client' rails AND the server `help/surface` barrel), and
// `lucide-react` is `external` in every case, so it never drags a directive across the server/client
// boundary. Keep it directive-free.

import type { ReactNode } from 'react'
import {
  AppWindow,
  ArrowLeftRight,
  Bot,
  Braces,
  FileText,
  Handshake,
  History,
  LayoutGrid,
  Library,
  Plug,
  RefreshCw,
  Rocket,
  Route,
  TriangleAlert,
  UserCheck,
  Webhook,
} from 'lucide-react'
import type { HelpTopicId } from './topics'

// Keyed by the exact HelpTopic.id (see topics.ts). Glyphs read as the topic: the assistant chat is a
// bot, Quickstart a rocket, OAuth a handshake and its steps the flow (overview=route, register=app
// window, authorize=user consent, token-exchange=swap, refresh=cycle), Reference a library and its
// leaves their kind (errors=warning, webhooks=webhook, changelog=history), REST API the braces of a
// JSON API, MCP a connector plug, Hub Features a grid of capabilities.
const TOPIC_ICON: Record<string, ReactNode> = {
  chat: <Bot size={16} aria-hidden />,
  quickstart: <Rocket size={16} aria-hidden />,
  oauth: <Handshake size={16} aria-hidden />,
  'oauth-overview': <Route size={16} aria-hidden />,
  'oauth-register-app': <AppWindow size={16} aria-hidden />,
  'oauth-authorize': <UserCheck size={16} aria-hidden />,
  'oauth-token-exchange': <ArrowLeftRight size={16} aria-hidden />,
  'oauth-refresh': <RefreshCw size={16} aria-hidden />,
  reference: <Library size={16} aria-hidden />,
  errors: <TriangleAlert size={16} aria-hidden />,
  webhooks: <Webhook size={16} aria-hidden />,
  changelog: <History size={16} aria-hidden />,
  'rest-api': <Braces size={16} aria-hidden />,
  mcp: <Plug size={16} aria-hidden />,
  hub: <LayoutGrid size={16} aria-hidden />,
}

/** The leading glyph for a help topic row, by topic id. Unmapped ids fall back to a document glyph,
 *  never the toolkit's empty fallback ring. */
export function topicIcon(id: HelpTopicId): ReactNode {
  return TOPIC_ICON[id] ?? <FileText size={16} aria-hidden />
}
