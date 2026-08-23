"use client";

import { defineSiteHome } from "@agentic-toolkit/adh/home";
import { ToolkitQueryProvider } from "@agentic-toolkit/data/query";
import { parseTokensPath, TokensFeature } from "@agentic-toolkit/authentication";

/**
 * The Authentication feature — this site's gated product surface
 * (docs/platform/feature-platform-phase2.md): the two token families as one hierarchical
 * topic/detail view, `Tokens ▸ API tokens ▸ <token>` and `Tokens ▸ Storage tokens ▸ <token>`.
 *
 * They are two topics rather than one list because they are two PRINCIPALS. A `tmp_` API token
 * acts as the signed-in user across the REST paths it is scoped to; an `adh_` storage token is a
 * principal in its own right, owned by the workspace, reaching only the bucket minted with it.
 * The hub's Settings ▸ Tokens topic still renders the flat single-family @agentic-toolkit/
 * authentication panel (TokensPanel) — this rework is this site's, not that one's.
 *
 * The package's OTHER pane (AccessPane, per-ecosystem bucket access) is NOT mounted here: it
 * requires the host's user/application directories (usersDirectory/applicationsDirectory), which
 * are hub-owned registries.
 *
 * This file DECLARES the route; SiteHomeRoute assembles it — reading the `[workspace]` param and
 * mounting what `render` returns inside SiteHomeShell, which resolves the workspace, keeps the
 * URL in step, and renders the chooser in a bar under the header. Declared here rather than in a
 * page because both `app/[workspace]/[[...path]]` and `app/home` mount it.
 *
 * A client module for two reasons at once: a model carries functions, which cannot cross from a
 * Server Component into the client shell; and the feature's react-query hooks read the toolkit's
 * OWN query runtime — ToolkitQueryProvider from @agentic-toolkit/data/query (the same physical
 * react-query module as the hooks; a host-constructed QueryClientProvider can never be, see that
 * module's doc) — mounted here since this site has no other react-query consumer.
 *
 * The workspace chooser above the view governs the STORAGE topic only: storage tokens belong to
 * the workspace's owning principal, so an org workspace lists and mints the org's. API tokens are
 * always the caller's own — the backend gives them no workspace dimension — so `workspaceSlug`
 * stops at the storage topic rather than being threaded into both and quietly meaning nothing in
 * one of them.
 *
 * Auth: both mounts sit under a HomeGate layout.
 */
export const authenticationHome = defineSiteHome({
  // The grammar below the workspace: `<section>` then `<tokenId>`, both optional and both
  // addressable, which is what the HTD recipe asks of every rail. An unrecognised section is a
  // `notFound()` inside the parser, not a selection that matches nothing.
  parse: parseTokensPath,
  render: ({ scopedBase, workspaceSlug, view }) => (
    <ToolkitQueryProvider>
      <TokensFeature
        basePath={scopedBase}
        section={view.section}
        tokenId={view.tokenId}
        workspaceSlug={workspaceSlug}
      />
    </ToolkitQueryProvider>
  ),
});

// The default export is what `app/home/page.tsx` and the workspace route import, so
// those two files can be the same bytes in every site. The named export above is the
// one this module's own documentation refers to; they are the same object.
export default authenticationHome;
