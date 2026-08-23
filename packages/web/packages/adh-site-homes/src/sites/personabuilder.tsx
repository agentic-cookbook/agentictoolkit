"use client";

import dynamic from "next/dynamic";
import { defineSiteHome } from "@agentic-toolkit/adh/home";
import { personaProfileUrl } from "@agentic-toolkit/adh-registry";
import { personaMemoryTables } from "@agentic-toolkit/knowledgebases/tables";
import { PersonasFeature } from "@agentic-toolkit/personas";
// PersonasSection fetches through the toolkit's react-query cache, which reads the
// toolkit's OWN QueryClient context — mount its provider here (same physical module
// as the hooks; a host-provided QueryClientProvider would be a different copy and
// invisible to them). Mirrors the sibling ecosystems site's mount.
import { ToolkitQueryProvider } from "@agentic-toolkit/data/query";
// Grammar from the server-safe ./parse subpath — the ONLY home for parse helpers now
// (the barrels deliberately do not re-export them; see any feature barrel's note).
import { parsePersonasPath } from "@agentic-toolkit/personas/parse";

const loading = () => <p className="p-4 text-sm text-apt-text-muted">Loading…</p>;
const KnowledgeBasesPane = dynamic(
  () => import("@agentic-toolkit/knowledgebases").then((m) => m.KnowledgeBasesPane),
  { loading },
);

// The persona-memory CRUD tables — the knowledgebases package's one implementation of the rule.
const KB_TABLES = personaMemoryTables();

/**
 * The Personas feature — this site's gated product surface
 * (docs/platform/feature-platform-phase2.md): the persona table + editor, the SAME
 * @agentic-toolkit/personas surface the hub's /<slug>/personas group renders.
 *
 * URL grammar (parsePersonasPath), now rooted at the workspace rather than at /home:
 *   /<ws> | /<ws>/<personaId> | /<ws>/<personaId>/<subTab>
 *
 * Host seams supplied here:
 * - profileUrlFor: the persona's public registry profile — the shared
 *   @agentic-toolkit/adh-registry personaProfileUrl rule (one owner; the hub uses the same).
 * - renderKnowledgeBases: the Knowledge facet embeds the knowledgebases pane with
 *   the persona-memory tables from the toolkit's generated catalog (the same
 *   schema rule the knowledgebases site's own mount applies).
 * - renderChatPane is NOT supplied: the live try-it chat is hub-only glue
 *   (@agentic-toolkit/persona/chat + the hub chat pane), so the editor shows its
 *   "Chat isn't available in this view." fallback here. Bringing chat to this site
 *   is a flagged follow-up, not a refactor concern.
 *
 * This file DECLARES the route; SiteHomeRoute assembles it — reading the `[workspace]` param and
 * the path below it, and mounting what `render` returns inside SiteHomeShell, which resolves the
 * workspace, keeps the URL in step, and renders the chooser in a bar under the header.
 * `scopedBase` arrives already built. Declared here rather than in a page because both
 * `app/[workspace]/[[...path]]` and `app/home` mount it.
 *
 * A client module for two reasons at once: two of the feature's host seams are functions, and so
 * are a model's own `parse`/`render` — neither can cross the serialization boundary.
 *
 * `workspaceSlug` is deliberately NOT passed: the persona list is token-scoped, which is what it
 * was before the workspace segment existed. Scoping it to the chosen workspace is the open
 * platform decision (feature-platform-phase2 §2), and it stays one prop at this seam.
 *
 * Auth: both mounts sit under a HomeGate layout; data is token-scoped.
 */
export const personaBuilderHome = defineSiteHome({
  parse: parsePersonasPath,
  render: ({ scopedBase, view }) => (
    <ToolkitQueryProvider>
      <PersonasFeature
        basePath={scopedBase}
        profileUrlFor={personaProfileUrl}
        renderKnowledgeBases={(scopeEcosystemId) => (
          <KnowledgeBasesPane tables={KB_TABLES} scopeEcosystemId={scopeEcosystemId} />
        )}
        {...view}
      />
    </ToolkitQueryProvider>
  ),
});

// The default export is what `app/home/page.tsx` and the workspace route import, so
// those two files can be the same bytes in every site. The named export above is the
// one this module's own documentation refers to; they are the same object.
export default personaBuilderHome;
