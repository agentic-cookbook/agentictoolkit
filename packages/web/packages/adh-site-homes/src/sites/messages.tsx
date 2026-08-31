"use client";

import { defineSiteHome, noSubPath } from "@agentic-toolkit/adh/home";
import { SiteHomePlaceholder } from "@agentic-toolkit/adh/layout";

/**
 * This site's workspace route — `/<workspace>`.
 *
 * Declared here rather than in a page because it is mounted TWICE: at
 * `app/[workspace]/[[...path]]` (the route itself) and at `app/home` (the workspace-less
 * entry every cross-site link names). SiteHomeRoute owns the assembly for both — it reads
 * the workspace segment and mounts what `render` returns inside SiteHomeShell, which
 * fetches the caller's workspaces, resolves the one to use (this URL's segment → their
 * stored preference → their personal workspace), keeps the URL in step, and renders the
 * chooser in a bar under the header.
 *
 * This site has no landing view of its own yet, so `render` is the shared placeholder. The
 * chooser above it is live either way; giving the site real content later is a change to
 * `render` and nothing else.
 *
 * It is a placeholder for a REASON, not for want of a writer, which is why the blurb says so
 * rather than leaving the default "coming soon". Direct messages are switched off across the
 * family while the per-product email/SMS Messaging tool ships (Product ▸ Messaging); the
 * chat/notification backend is intact and it is the UI that is parked. The hub's
 * `/<workspace>/messaging` route said exactly this in its own words until 2026-08-31, when it
 * became a generated mount of this model — one statement, both hosts, which is the point.
 * When DMs come back this file is where they arrive, and the hub gets them without a change.
 *
 * A client module because a model carries functions, and functions cannot cross from a
 * Server Component into the client shell — see SiteHomeRoute.
 *
 * Auth: both mounts sit under a HomeGate layout.
 */
export const messagesHome = defineSiteHome({
  // No grammar below the workspace: `/<workspace>` is this site's whole address. `noSubPath`
  // is the family's way of saying so — every site mounts the same optional catch-all, so the
  // depth a site accepts is a line here rather than which directories it happens to have.
  parse: noSubPath,
  render: () => (
    <SiteHomePlaceholder
      siteId="messages"
      blurb="Direct messages are paused while the per-product Messaging tool ships — you'll find email and SMS to a product's customers under Product ▸ Messaging in the meantime."
    />
  ),
});

// The default export is what `app/home/page.tsx` and the workspace route import, so
// those two files can be the same bytes in every site. The named export above is the
// one this module's own documentation refers to; they are the same object.
export default messagesHome;
