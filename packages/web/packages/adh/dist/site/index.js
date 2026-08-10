// src/site/SiteConfig.ts
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
      silentSso: site.silentSso
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
  // community — app/{categories,discussions,forum,people,topics}. (`admin` is below.) `forum` is
  // the board: it was this site's `/home` until `/home` became the family's workspace redirect,
  // and it is the one segment the convergence itself minted.
  "categories",
  "discussions",
  "forum",
  "people",
  "topics",
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
  // personaregistry — app/{org,persona}. (`user` is below.)
  "org",
  "persona",
  // research — app/{papers,search}.
  "papers",
  "search",
  // toolkit — app/demo.
  "demo"
];
var GRAMMAR_SEGMENTS = [
  // organizations, teams, projects, ecosystems — `parse-path.ts`, the "all" landing.
  "all"
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
  // the rest are rail routes listed outside it, plus `ecosystems`, the retired segment Products
  // replaced, held back so stale links resolve predictably instead of landing on a profile.
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