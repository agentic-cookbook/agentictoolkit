"use client";

import dynamic from "next/dynamic";
import { defineSiteHome } from "@agentic-toolkit/adh/home";
import { personaProfileUrl } from "@agentic-toolkit/adh-registry";
import { personaMemoryTables } from "@agentic-toolkit/knowledgebases/tables";
import { PersonasFeature } from "@agentic-toolkit/personas";
// Relative, not a package subpath: ProfilePersonas lives IN this site now (it imports the adh
// vocabulary tier, which a portable @agentic-toolkit package may not — see its own docblock),
// not in @agentic-toolkit/personas.
import { ProfilePersonas } from "./ProfilePersonas";
// PersonasSection fetches through the toolkit's react-query cache, which reads the
// toolkit's OWN QueryClient context — mount its provider here (same physical module
// as the hooks; a host-provided QueryClientProvider would be a different copy and
// invisible to them). Mirrors the sibling personabuilder site's mount.
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
 * The Personas feature — this site's gated product surface, and the REASON Personas left the
 * hub's workspace rail: agenticdeveloperpersonas.com is where you define personas now, so the
 * hub stopped offering the topic (see ALL_FEATURES in the hub's workspace-features.ts — the
 * `/<workspace>/personas` route still resolves for links that already exist, but nothing points
 * at it). This is the SAME @agentic-toolkit/personas surface that route renders.
 *
 * URL grammar (parsePersonasPath), rooted at the workspace:
 *   /<ws> | /<ws>/<personaId> | /<ws>/<personaId>/<subTab>
 *
 * Host seams supplied here — the same two the sibling personabuilder site supplies, from the
 * same owners, so the two mounts of this feature cannot drift:
 * - profileUrlFor: the persona's public registry profile — the shared
 *   @agentic-toolkit/adh-registry personaProfileUrl rule (the hub uses the same one).
 * - renderKnowledgeBases: the Knowledge facet embeds the knowledgebases pane with the
 *   persona-memory tables from the toolkit's generated catalog.
 * - renderChatPane is NOT supplied: the live try-it chat is hub-only glue
 *   (@agentic-toolkit/persona/chat + the hub's own chat pane), so the editor shows its
 *   "Chat isn't available in this view." fallback here — the same fallback personabuilder
 *   shows. Bringing chat to a feature site is a flagged follow-up, not a refactor concern.
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
 * `workspaceSlug` is deliberately NOT passed, matching personabuilder: the persona list is
 * token-scoped here. The hub's `/<workspace>/personas` pane DID owner-scope it (an org workspace
 * showed the org's personas), so this mount is the looser of the two — scoping a feature site to
 * the chosen workspace is the open platform decision (feature-platform-phase2 §2), and answering
 * it differently on the two personas mounts is what would put them out of step. It stays one prop
 * at this seam.
 *
 * Auth: both mounts sit under a HomeGate layout; data is token-scoped.
 */
export const personasHome = defineSiteHome({
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
  profileSection: (principal) => <ProfilePersonas principal={principal} />,
});

// The default export is what `app/home/page.tsx` and the workspace route import, so
// those two files can be the same bytes in every site. The named export above is the
// one this module's own documentation refers to; they are the same object.
export default personasHome;
