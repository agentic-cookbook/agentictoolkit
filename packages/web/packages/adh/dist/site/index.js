// src/site/SiteConfig.ts
import { SITE_TITLE_HELP_ID } from "@agentic-toolkit/ui/lib/help-ids";
var FAMILY_ROBOTS_DISALLOW = [
  "/login",
  "/signup",
  "/home",
  "/api/",
  "/auth/"
];
function defineSite(site) {
  return {
    id: site.id,
    seo: site.seo,
    robotsDisallow: site.robotsDisallow ?? FAMILY_ROBOTS_DISALLOW,
    sitemap: site.sitemap,
    homeGate: site.homeGate,
    workspaceGate: site.workspaceGate,
    authCallback: site.authCallback,
    shell: {
      siteId: site.id,
      header: site.header,
      providers: site.providers,
      navLinks: site.navLinks,
      trailingNavLinks: site.trailingNavLinks,
      footerLinks: site.footerLinks,
      silentSso: site.silentSso,
      // Derived, not required: every site already describes its purpose in `seo.description`,
      // and a fourth copy of that sentence is how the cookbook's sections.ts ended up warning
      // that "Nothing reports a disagreement between the two". A site's own entry wins.
      help: {
        [SITE_TITLE_HELP_ID]: { body: site.seo.description, flavor: "info" },
        ...site.help
      }
    }
  };
}
async function siteSitemapRoutes(site) {
  return typeof site.sitemap === "function" ? site.sitemap() : site.sitemap;
}

// src/site/reservedSlugs.ts
var FAMILY_ROUTE_SEGMENTS = [
  "auth",
  // app/auth — the SSO callback
  "home",
  // app/home — the workspace-resolving redirect
  "details",
  // app/details/[topic] — the shared concept pages
  "privacy",
  "terms",
  "tour",
  // the landing deck's second route
  // Not a directory on any site: `marketingNextConfig` rewrites `/api/*` to the backend, so
  // the segment is spoken for on all 42 without appearing in any `app/` tree.
  "api",
  // Next serves these from FILES at the root of `app/`, so they occupy the same segment as a
  // slug even though no directory names them.
  "favicon.ico",
  "icon.svg",
  "apple-icon.png",
  "opengraph-image.png",
  "robots.txt",
  "sitemap.xml",
  // The framework's own namespace.
  "_next"
];
var SITE_ROUTE_SEGMENTS = [
  // billing — app/claim, the link a purchaser follows out of Stripe's receipt. One site's route,
  // reserved on all 42 for the reason at the top of this list: the mint form's question is not
  // "is this free HERE" but "is this free ANYWHERE".
  "claim",
  // community — app/{categories,discussions,forum,people,topics}. (`admin` is below.) `forum` is
  // the board: it was this site's `/home` until `/home` became the family's workspace redirect,
  // and it is the one segment the convergence itself minted.
  "categories",
  "discussions",
  "forum",
  "people",
  "topics",
  // consultants — app/consultant/[entry], the public profile of one directory entry. The site is
  // named in the plural and the route in the singular, so the reserved word is the one the URL
  // spends, not the one on the tin.
  "consultant",
  // cookbook — the corpus IS these nine words. Each is a real directory,
  // `app/(reader)/<section>/[[...slug]]`, so `/guidelines/testing/test-pyramid` is a document's
  // own address with nothing in front of it; the route group contributes no segment. They are
  // reserved because a static segment beats `[workspace]`, not because a redirect claims them —
  // there is no `/docs` prefix any more, and the entry in RESERVED_HANDLE_WORDS below is taste,
  // not this site. `projects` is cookbook's ninth section directory as well as the hub's
  // feature-page redirect, and is listed once, under the hub. This is the cost recorded in that
  // site's `.claude/rules/site-design.md` — adding a section to the book adds a reserved slug
  // for the whole family.
  "introduction",
  "principles",
  "guidelines",
  "ingredients",
  "recipes",
  "compliance",
  "reference",
  "appendix",
  // hub — app/{features,integrations,old-landing}, app/(auth)/{join,oidc}, app/(hub)/explore.
  // (`login`, `signup`, `contact`, `settings` and `user` are below.) `old-landing` is the
  // superseded hero page, still routable and deliberately kept so, which makes it a segment
  // like any other. `features` is where the eight marketing pages moved to when the root
  // segment became `[workspace]`, and it is a real directory: `app/features/[id]/`. The
  // integrations SITE routes `integrations` too — `app/integrations/oauth-callback`, where a
  // provider's OAuth redirect lands, at a path `oauthCallbackUrl()` builds from the window's own
  // origin and so cannot vary per site. Every site that mounts that feature grows the same
  // directory; the word is listed once.
  "features",
  "integrations",
  "join",
  "oidc",
  "explore",
  "old-landing",
  // hub — the marketing feature pages. These are not directories either: they were served
  // by `app/[slug]/page.tsx`, which dispatched on the slug ahead of a user profile, and the
  // root segment is `[workspace]` now — so each is a permanent REDIRECT source in the hub's
  // `next.config.ts` (`/<id>` → `/features/<id>`), derived from the same list the route's
  // generateStaticParams reads. A redirect answers before any route does, so the segment is
  // spoken for exactly as a directory's is, and these stay here rather than moving down to
  // RESERVED_HANDLE_WORDS: they are addressable URLs, not merely words a handle may not take.
  "agentic-personas",
  "persona-data-store",
  "user-data-store",
  "status-pages",
  "rest-api",
  "mcp",
  "applications",
  "projects",
  // personaregistry — `org` and `persona`, both REDIRECT sources in that site's `next.config.ts`
  // for the same reason the hub's eight above are: a redirect source claims its segment as
  // surely as a directory does. Neither is a directory there any more. `app/persona/[slug]`
  // existed only while the family's `[workspace]` sat at that site's root; `app/org/[slug]` was
  // older and outlived that window. Personas, users and organizations all address off the ROOT
  // now (`app/[slug]`) — an org is shown the way a user is, so it needs no prefix — and the old
  // prefixes stayed behind pointing at it. (`user` is the hub's public profile prefix, listed
  // above, and is a redirect source on this site too.)
  "org",
  "persona",
  // registries — app/registry/[registry] and app/registry/[registry]/[entry]: one owner-built
  // directory, and one entry within it. Singular for the same reason `consultant` is.
  "registry",
  // research — app/{papers,search}.
  "papers",
  "search",
  // toolkit — app/demo.
  "demo"
];
var GRAMMAR_SEGMENTS = [
  // organizations, teams, projects, ecosystems — `parse-path.ts`, the "all" landing.
  "all",
  // games — `parse-path.ts` compares the first segment IT is handed to `"new"` before reading
  // it as a game id, so `/<workspace>/new` is the create-game dialog. That is the second URL
  // segment, so unlike a route directory it cannot shadow a workspace slug; it is listed anyway
  // on the reasoning the rest of this file records — a slug is minted once, against every site
  // at once, and `all` above is here for exactly the same reason.
  "new"
];
var RESERVED_HANDLE_WORDS = [
  "about",
  "admin",
  "assets",
  "billing",
  "blog",
  "contact",
  "dashboard",
  "docs",
  "help",
  "legal",
  "login",
  "logout",
  "me",
  "monitoring",
  "pricing",
  "profile",
  "public",
  "register",
  "session",
  "sessions",
  "settings",
  "signin",
  "signout",
  "signup",
  "static",
  "status",
  "support",
  "user",
  "users",
  // The hub's feature vocabulary. Every one of these is a SECOND segment — `/<workspace>/teams`,
  // `/<workspace>/tokens` — so none of them shadows a slug, and that is why they sit here rather
  // than in SITE_ROUTE_SEGMENTS. The hub refused them anyway, on the grounds that a profile slug
  // reading as one of its own feature words is a URL nobody can parse at a glance, and that
  // judgement is kept. The first group mirrors `FEATURES` in the hub's `data/feature-routes.ts`;
  // the rest are rail routes listed outside it, plus the two RETIRED segments — `ecosystems`,
  // which Products replaced, and `communities`, whose hub route rendered "Coming soon" until
  // agenticdevelopercommunities.com took the topic over. Both are held back so a stale link
  // resolves predictably instead of landing on whichever user claimed the handle.
  "all-data",
  "communities",
  "dashboards",
  "ecosystems",
  "email-signup",
  "feature-flags",
  "gamification",
  "invitations",
  "knowledgebases",
  "llm-providers",
  "members",
  "messaging",
  "narratives",
  "persona-services",
  "personas",
  "products",
  "registries",
  "research",
  "server-bags",
  "signin-apps",
  "storage",
  "teams",
  "tokens"
];
function reservedWorkspaceSlugs() {
  const all = [
    ...FAMILY_ROUTE_SEGMENTS,
    ...SITE_ROUTE_SEGMENTS,
    ...GRAMMAR_SEGMENTS,
    ...RESERVED_HANDLE_WORDS
  ];
  return new Set(all.map((s) => s.toLowerCase()));
}

// src/site/index.ts
import { isHubWorkspacePath, hubWorkspaceSlug } from "@agentic-toolkit/adh/site/hubWorkspacePath";
export {
  FAMILY_ROBOTS_DISALLOW,
  FAMILY_ROUTE_SEGMENTS,
  GRAMMAR_SEGMENTS,
  RESERVED_HANDLE_WORDS,
  SITE_ROUTE_SEGMENTS,
  defineSite,
  hubWorkspaceSlug,
  isHubWorkspacePath,
  reservedWorkspaceSlugs,
  siteSitemapRoutes
};
//# sourceMappingURL=index.js.map