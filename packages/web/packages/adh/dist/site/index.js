// src/site/SiteConfig.ts
import { SITE_TITLE_HELP_ID } from "@agentic-toolkit/adh-ui/help-ids";
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
  "all"
  // No parser spends this one today. `games/parse-path.ts` did — `/<workspace>/new` opened the
  // create-game dialog — and it went when the games rail became a list of products and a game
  // stopped being something you create directly (2026-08-22, `product-gaming-modes`).
  //
  // It stays reserved anyway, and deliberately: reserving a word is reversible and un-reserving
  // one is not. Delete this line and the very next customer may mint a workspace called `new`,
  // at which point no future grammar in any of the twelve features can ever spend the word
  // again — the obvious word for "the create screen", held by one account, fleet-wide, forever.
  // The word is still held back — it moved to RESERVED_HANDLE_WORDS, which is the list for a
  // refusal that is NOT shadowing. Keeping it here would have made this list say something false
  // about itself: every entry above is a segment some parser really compares against, and that
  // is the only claim this list makes.
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
  // Held on the same footing as the rest of this list, not because anything routes it.
  // `games/parse-path.ts` matched `/<workspace>/new` for the create-game dialog until
  // 2026-08-22 (`product-gaming-modes`), and when that grammar went the word came here rather
  // than being un-reserved: `new` is the obvious word for "the create screen", so letting one
  // account claim it fleet-wide, permanently, to buy back a name nobody has asked for is the
  // trade this list's own docstring declines to make. If a grammar spends the segment again,
  // it belongs back in GRAMMAR_SEGMENTS — and in the backend's RESERVED_ROUTE_SLUGS, which
  // dropped it because that list admits only words a live route or grammar earns.
  "new",
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
  // the rest are rail routes listed outside it, plus ONE retired segment — `ecosystems`, which
  // Products replaced: the ecosystems site maps to the `products` segment, so no hub route
  // spends the word. It is held back so a stale link resolves predictably instead of landing on
  // whichever user claimed the handle.
  //
  // `communities` was the second retired segment and is not one any more: when the fleet came
  // home, agenticdevelopercommunities.com's own workspace became `/<workspace>/communities`, so
  // the word is a live hub route again and is reserved on the ordinary grounds beside it.
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