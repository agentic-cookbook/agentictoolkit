'use client'

"use client";

// src/help/HelpMasterDetail.tsx
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { HierarchicalDetailView } from "@agentic-toolkit/ui/blocks";

// src/help/topic-icons.tsx
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
  Webhook
} from "lucide-react";
import { jsx } from "react/jsx-runtime";
var TOPIC_ICON = {
  chat: /* @__PURE__ */ jsx(Bot, { size: 16, "aria-hidden": true }),
  quickstart: /* @__PURE__ */ jsx(Rocket, { size: 16, "aria-hidden": true }),
  oauth: /* @__PURE__ */ jsx(Handshake, { size: 16, "aria-hidden": true }),
  "oauth-overview": /* @__PURE__ */ jsx(Route, { size: 16, "aria-hidden": true }),
  "oauth-register-app": /* @__PURE__ */ jsx(AppWindow, { size: 16, "aria-hidden": true }),
  "oauth-authorize": /* @__PURE__ */ jsx(UserCheck, { size: 16, "aria-hidden": true }),
  "oauth-token-exchange": /* @__PURE__ */ jsx(ArrowLeftRight, { size: 16, "aria-hidden": true }),
  "oauth-refresh": /* @__PURE__ */ jsx(RefreshCw, { size: 16, "aria-hidden": true }),
  reference: /* @__PURE__ */ jsx(Library, { size: 16, "aria-hidden": true }),
  errors: /* @__PURE__ */ jsx(TriangleAlert, { size: 16, "aria-hidden": true }),
  webhooks: /* @__PURE__ */ jsx(Webhook, { size: 16, "aria-hidden": true }),
  changelog: /* @__PURE__ */ jsx(History, { size: 16, "aria-hidden": true }),
  "rest-api": /* @__PURE__ */ jsx(Braces, { size: 16, "aria-hidden": true }),
  mcp: /* @__PURE__ */ jsx(Plug, { size: 16, "aria-hidden": true }),
  hub: /* @__PURE__ */ jsx(LayoutGrid, { size: 16, "aria-hidden": true })
};
function topicIcon(id) {
  return TOPIC_ICON[id] ?? /* @__PURE__ */ jsx(FileText, { size: 16, "aria-hidden": true });
}

// src/help/HelpMasterDetail.tsx
import { jsx as jsx2 } from "react/jsx-runtime";
function HelpMasterDetail({
  levels,
  rootLabel,
  children
}) {
  const router = useRouter();
  const topicLevels = useMemo(
    () => levels.map((l) => {
      const hrefById = new Map(l.items.map((it) => [it.id, it.href]));
      return {
        id: l.key,
        title: l.title,
        // topicIcon(it.id) gives every row a topic glyph in place of HMDV's neutral fallback ring —
        // the item id IS the HelpTopic id, so the same map serves the root and every nested level.
        items: l.items.map((it) => ({
          id: it.id,
          label: it.label,
          description: it.description,
          icon: topicIcon(it.id)
        })),
        selectedId: l.selectedId,
        // Every help level IS a topic browser, so its card grid (icon + label + description per
        // row) is the level's real landing page — not a placeholder to nudge past. HMDV's default
        // unselected-frontier detail is the quiet "select something" hint, so each level opts into
        // the cards explicitly.
        overview: "cards",
        onSelect: (id) => {
          const href = hrefById.get(id);
          if (href) router.push(href);
        },
        onClear: () => router.push(l.clearHref)
      };
    }),
    [levels, router]
  );
  return /* @__PURE__ */ jsx2(
    HierarchicalDetailView,
    {
      levels: topicLevels,
      rootLabel,
      disclosureStyle: "cascading",
      autoHideTopics: true,
      exitGuard: null,
      children
    }
  );
}
export {
  HelpMasterDetail
};
//# sourceMappingURL=HelpMasterDetail.js.map