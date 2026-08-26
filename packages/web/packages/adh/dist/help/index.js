'use client'

"use client";

// src/help/HelpProvider.tsx
import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

// src/help/topics.ts
var HELP_TOPICS = [
  {
    id: "chat",
    label: "Chat",
    slug: "chat",
    description: "Ask bitbag anything about building on the Agentic Developer Hub.",
    view: "chat"
  },
  {
    // Placeholder section: no guide content of its own (the old walkthrough was stale and was
    // removed) — selecting it opens OAuth beneath, so its landing is the children overview, exactly
    // like Reference. Give it a `contentKey` again when a real quickstart guide is written.
    id: "quickstart",
    label: "Quickstart",
    slug: "quickstart",
    description: "Register an app, get a token, and make your first call.",
    children: [
      {
        id: "oauth",
        label: "OAuth",
        slug: "quickstart/oauth",
        description: "Authorize on behalf of a user with the OAuth 2.0 flow.",
        children: [
          { id: "oauth-overview", label: "Overview", slug: "quickstart/oauth/overview", description: "How the flow fits together.", contentKey: "oauth-overview" },
          { id: "oauth-register-app", label: "Register app", slug: "quickstart/oauth/register-app", description: "Create OAuth credentials.", contentKey: "oauth-register-app" },
          { id: "oauth-authorize", label: "Authorize", slug: "quickstart/oauth/authorize", description: "Send the user to consent.", contentKey: "oauth-authorize" },
          { id: "oauth-token-exchange", label: "Token exchange", slug: "quickstart/oauth/token-exchange", description: "Trade the code for tokens.", contentKey: "oauth-token-exchange" },
          { id: "oauth-refresh", label: "Refresh", slug: "quickstart/oauth/refresh", description: "Keep the session alive.", contentKey: "oauth-refresh" }
        ]
      }
    ]
  },
  {
    id: "reference",
    label: "Reference",
    slug: "reference",
    description: "Error codes, webhooks, and what changed.",
    children: [
      { id: "errors", label: "Errors", slug: "reference/errors", description: "Error codes and what they mean.", contentKey: "errors" },
      { id: "webhooks", label: "Webhooks", slug: "reference/webhooks", description: "Events the hub can push to you.", contentKey: "webhooks" },
      { id: "changelog", label: "Changelog", slug: "reference/changelog", description: "Recent API changes.", contentKey: "changelog" }
    ]
  },
  {
    id: "rest-api",
    label: "REST API",
    slug: "rest-api",
    description: "Browse every REST endpoint and try calls against your session.",
    view: "api"
  },
  {
    // A section, not a monolithic page: the old single mcp.md split into per-concern child topics.
    // Unlike Quickstart and Reference it does NOT land on the children's select nudge: /mcp is the
    // published address of the MCP docs (the MCP host's root redirects a browser here, as do three
    // `/docs/mcp` redirects), so arriving there must read as documentation, not as a menu. The
    // `landingChildId` auto-selects Overview — the reader lands on prose with the siblings beside it.
    id: "mcp",
    label: "MCP",
    slug: "mcp",
    description: "Connect an agent to the hub over the Model Context Protocol.",
    landingChildId: "mcp-overview",
    children: [
      { id: "mcp-overview", label: "Overview", slug: "mcp/overview", description: "What the MCP server is, and how it relates to the REST API.", contentKey: "mcp-overview" },
      { id: "mcp-connect", label: "Connect a client", slug: "mcp/connect", description: "Point Claude Desktop, Claude Code, Cursor, or the Inspector at the server.", contentKey: "mcp-connect" },
      { id: "mcp-tools", label: "Tools", slug: "mcp/tools", description: "Every tool the server exposes, grouped by area.", contentKey: "mcp-tools" },
      { id: "mcp-details", label: "Details", slug: "mcp/details", description: "Transport, auth, session, and data-scope facts.", contentKey: "mcp-details" }
    ]
  },
  {
    // Same split as MCP: the old hub-features.md's H2 sections are now child topics, one per
    // feature area, so /hub lands on the children level's select nudge with those children in the
    // rail beside it — the same landing Quickstart, Reference and MCP get.
    id: "hub",
    label: "Hub Features",
    slug: "hub",
    description: "What you can do across the Agentic Developer Hub.",
    children: [
      { id: "hub-overview", label: "Overview", slug: "hub/overview", description: "How workspaces scope everything you do in the Hub.", contentKey: "hub-overview" },
      { id: "hub-workspaces", label: "Workspaces & account", slug: "hub/workspaces", description: "Workspaces, settings, members, and API tokens.", contentKey: "hub-workspaces" },
      { id: "hub-personas", label: "Personas", slug: "hub/personas", description: "Design, register, and run AI personas.", contentKey: "hub-personas" },
      { id: "hub-products", label: "Products", slug: "hub/products", description: "Ecosystems: apps, tokens, customers, flags, and gamification.", contentKey: "hub-products" },
      { id: "hub-storage", label: "Storage & data", slug: "hub/storage", description: "Buckets, files, access, and data integrations.", contentKey: "hub-storage" },
      { id: "hub-plan", label: "Plan", slug: "hub/plan", description: "Projects, narratives, and research.", contentKey: "hub-plan" },
      { id: "hub-teams", label: "Teams", slug: "hub/teams", description: "Member teams, the team registry, and the team builder.", contentKey: "hub-teams" },
      { id: "hub-community", label: "Community & support", slug: "hub/community", description: "Discussions, support, news, and messaging.", contentKey: "hub-community" },
      { id: "hub-monitoring", label: "Monitoring", slug: "hub/monitoring", description: "Dashboards that watch your sites and endpoints.", contentKey: "hub-monitoring" },
      { id: "hub-apis", label: "APIs & agents", slug: "hub/apis", description: "The REST API, MCP, OAuth, and reusable tools.", contentKey: "hub-apis" }
    ]
  }
];
function isLeaf(topic) {
  return !topic.children || topic.children.length === 0;
}
function findTopicPath(id, topics = HELP_TOPICS) {
  for (const topic of topics) {
    if (topic.id === id) return [topic];
    if (topic.children) {
      const deeper = findTopicPath(id, topic.children);
      if (deeper) return [topic, ...deeper];
    }
  }
  return null;
}

// src/help/HelpProvider.tsx
import { jsx, jsxs } from "react/jsx-runtime";
var HelpWindow = dynamic(
  () => import("@agentic-toolkit/adh/help/HelpWindow").then((m) => m.HelpWindow)
);
var HelpContext = createContext(null);
function HelpProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [path, setPath] = useState([]);
  const open = useCallback((topicId) => {
    if (topicId) {
      const nodes = findTopicPath(topicId);
      setPath(nodes ? nodes.map((n) => n.id) : []);
    }
    setIsOpen(true);
  }, []);
  const close = useCallback(() => setIsOpen(false), []);
  const value = useMemo(() => ({ isOpen, open, close }), [isOpen, open, close]);
  return /* @__PURE__ */ jsxs(HelpContext.Provider, { value, children: [
    children,
    isOpen && /* @__PURE__ */ jsx(HelpWindow, { open: true, onClose: close, path, onPathChange: setPath })
  ] });
}
function useHelp() {
  return useContext(HelpContext) ?? NOOP;
}
var NOOP = { isOpen: false, open: () => {
}, close: () => {
} };

// src/help/index.ts
import { HelpWindow as HelpWindow2 } from "@agentic-toolkit/adh/help/HelpWindow";
export {
  HELP_TOPICS,
  HelpProvider,
  HelpWindow2 as HelpWindow,
  findTopicPath,
  isLeaf,
  useHelp
};
//# sourceMappingURL=index.js.map