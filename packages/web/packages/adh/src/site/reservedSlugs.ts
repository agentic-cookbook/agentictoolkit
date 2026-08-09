/**
 * The names a workspace slug may not take.
 *
 * The workspace is the FIRST path segment on every site in the family — `/<workspace>` — so
 * a slug competes for that segment with the template's own static routes. Next resolves a
 * static segment ahead of a dynamic one, and it does not fall through to the dynamic one
 * when the static directory exists but has no page at that level, so a principal whose slug
 * is one of these names is unreachable at its own address whether the name renders something
 * else or plain 404s.
 *
 * That is why this lives in the toolkit rather than in a site. A slug is minted ONCE — it is
 * the principal's handle — and it is spent at the root of all 38 sites, so what may be
 * reserved is a fact about the shared template, not about whichever site's form happens to
 * take the input. Two sites offer that form (personaregistry's settings pane and the hub's),
 * and each used to carry its own hand-written answer.
 *
 * The server refuses a NARROWER set, and this list is the wider one. `RESERVED_PRINCIPAL_SLUGS`
 * in `backend/src/adh/src/lib/rdid.ts` is the rdid type prefixes plus `RESERVED_ROUTE_SLUGS`,
 * and `/auth/slug-available/:slug` reports a hit there as `reason: 'format'` — so a word that
 * shadows a route is refused whichever way the slug is minted, while the words held back on
 * taste alone (`admin`, `login`, the hub's feature vocabulary) are refused only by the two
 * forms. `frontend/tools/verify_reserved_route_slugs.py` is what keeps the narrow set from
 * falling behind the route trees, and it checks this list against them too.
 *
 * Adding a name here narrows what the forms will accept; it does not evict a slug already
 * stored, on either side — both are mint-time refusals.
 */

/**
 * Top-level route segments the site template itself owns.
 *
 * Measured from the 38 `app/` trees, not assumed: `auth` and `home` exist in all 38 today,
 * and `details`, `privacy`, `terms` and `tour` in every site that has been through the
 * template. They are listed unconditionally rather than per-site because the template is
 * what decides them — a site that lacks one today gets it on the next template change, and a
 * slug reserved slightly early costs a handle nobody has, while one reserved slightly late
 * costs a principal their address on 38 sites at once.
 */
export const FAMILY_ROUTE_SEGMENTS: readonly string[] = [
  'auth', // app/auth — the SSO callback
  'home', // app/home — the workspace-resolving redirect
  'details', // app/details/[topic] — the shared concept pages
  'privacy',
  'terms',
  'tour', // the landing deck's second route
  // Not a directory on any site: `marketingNextConfig` rewrites `/api/*` to the backend, so
  // the segment is spoken for on all 38 without appearing in any `app/` tree.
  'api',
  // Next serves these from FILES at the root of `app/`, so they occupy the same segment as a
  // slug even though no directory names them.
  'favicon.ico',
  'icon.svg',
  'apple-icon.png',
  'opengraph-image.png',
  'robots.txt',
  'sitemap.xml',
  // The framework's own namespace.
  '_next',
]

/**
 * First URL segments an individual site adds beyond the template.
 *
 * Every one of these shadows a workspace on the site that owns it, and each is reserved on
 * all 38 anyway. That is the whole point of the list: a slug is minted once, so the question
 * a mint form has to answer is not "is this free HERE" but "is this free ANYWHERE", and the
 * only list that can answer it is one list. Reserving cookbook's `papers`-shaped words on
 * academy costs a handle nobody holds; not reserving them costs a principal their address on
 * whichever site they forgot about.
 *
 * Measured from the 38 `app/` trees plus the two `next.config.ts` files that add redirects —
 * a route group contributes nothing to the URL, so its children are first segments too, and a
 * redirect source occupies its segment as surely as a directory does. Regenerate the reading
 * rather than editing from memory; the sites move.
 */
export const SITE_ROUTE_SEGMENTS: readonly string[] = [
  // community — app/{categories,discussions,forum,people,topics}. (`admin` is below.) `forum` is
  // the board: it was this site's `/home` until `/home` became the family's workspace redirect,
  // and it is the one segment the convergence itself minted.
  'categories',
  'discussions',
  'forum',
  'people',
  'topics',
  // cookbook — the corpus lives under `docs` (below), but its nine section words are still
  // spoken for: `next.config.ts` 308s `/<section>/:path*` into `/docs/<section>/:path*` so the
  // book's original URLs keep resolving, and a redirect answers before any route does. This is
  // the cost recorded in that site's `.claude/rules/site-design.md` — adding a section to the
  // book adds a reserved slug for the whole family.
  'introduction',
  'principles',
  'guidelines',
  'ingredients',
  'recipes',
  'compliance',
  'reference',
  'appendix',
  // hub — app/{integrations,old-landing}, app/(auth)/{join,oidc}, app/(hub)/explore.
  // (`login`, `signup` and `contact` are below.) `old-landing` is the superseded hero page,
  // still routable and deliberately kept so, which makes it a segment like any other.
  'integrations',
  'join',
  'oidc',
  'explore',
  'old-landing',
  // hub — the marketing feature pages. These are not directories: `app/[slug]/page.tsx`
  // dispatches on the slug and serves the feature page ahead of a user profile, so the
  // shadowing is done in code rather than by the router. It shadows exactly the same.
  'agentic-personas',
  'persona-data-store',
  'user-data-store',
  'status-pages',
  'rest-api',
  'mcp',
  'applications',
  'projects',
  // personaregistry — app/{org,persona}. (`user` is below.)
  'org',
  'persona',
  // research — app/{papers,search}.
  'papers',
  'search',
  // toolkit — app/demo.
  'demo',
]

/**
 * Names refused for a reason other than shadowing.
 *
 * Nothing here is load-bearing for addressability: none of these is a first URL segment on any
 * site — that is what the two lists above are for. These are words a handle should not be able
 * to claim because the handle appears next to the site's own vocabulary, and `/admin`,
 * `/login`, `/settings` read as the site speaking rather than as a person.
 *
 * The first group is the union of what personaregistry and the hub each already refused before
 * this list existed. Un-reserving a name that has been refused for years is a decision with its
 * own consequences — someone claims it, and it can never be taken back — so the merge keeps
 * both sides rather than trimming to what is provably needed.
 */
export const RESERVED_HANDLE_WORDS: readonly string[] = [
  'about',
  'admin',
  'assets',
  'billing',
  'blog',
  'contact',
  'dashboard',
  'docs',
  'help',
  'legal',
  'login',
  'logout',
  'me',
  'monitoring',
  'pricing',
  'profile',
  'public',
  'register',
  'session',
  'sessions',
  'settings',
  'signin',
  'signout',
  'signup',
  'static',
  'status',
  'support',
  'user',
  'users',
  // The hub's feature vocabulary. Every one of these is a SECOND segment — `/<workspace>/teams`,
  // `/<workspace>/tokens` — so none of them shadows a slug, and that is why they sit here rather
  // than in SITE_ROUTE_SEGMENTS. The hub refused them anyway, on the grounds that a profile slug
  // reading as one of its own feature words is a URL nobody can parse at a glance, and that
  // judgement is kept. The first group mirrors `FEATURES` in the hub's `data/feature-routes.ts`;
  // the rest are rail routes listed outside it, plus `ecosystems`, the retired segment Products
  // replaced, held back so stale links resolve predictably instead of landing on a profile.
  'all-data',
  'communities',
  'dashboards',
  'ecosystems',
  'email-signup',
  'feature-flags',
  'gamification',
  'invitations',
  'knowledgebases',
  'llm-providers',
  'members',
  'messaging',
  'narratives',
  'persona-services',
  'personas',
  'products',
  'research',
  'server-bags',
  'signin-apps',
  'storage',
  'teams',
  'tokens',
]

/**
 * Every name a workspace slug may not take, on any site in the family.
 *
 * It takes no arguments, and that is the load-bearing part. It used to accept the extra
 * segments a caller's own site adds, which quietly made reservation a per-site answer: hub
 * passed its list and personaregistry passed a different one, so a slug minted on either was
 * only ever checked against the site it was typed into and could land on a name some OTHER
 * site had already spent. A slug is one slug, so the answer is one answer.
 *
 * Everything is lowercased on the way out, because the callers lowercase the slug before the
 * lookup and a mixed-case entry would sit in the set matching nothing.
 */
export function reservedWorkspaceSlugs(): ReadonlySet<string> {
  const all = [...FAMILY_ROUTE_SEGMENTS, ...SITE_ROUTE_SEGMENTS, ...RESERVED_HANDLE_WORDS]
  return new Set(all.map((s) => s.toLowerCase()))
}
