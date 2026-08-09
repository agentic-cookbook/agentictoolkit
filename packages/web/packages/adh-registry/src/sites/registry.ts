// Single source of truth for the ADH site family: display names, production
// hosts, which deploy environments exist, and which sites expose the shared
// auth-gated /home route. The header's site-switcher and the route-fallback
// not-found page both read from here.
//
// Hosts come from the deployment domain table in the repo CLAUDE.md (the
// authoritative source). Testing/staging hosts are derived by prepending
// `testing.`/`staging.` to the production host.

export type SiteId =
  | 'bitbag'
  | 'hub'
  | 'hub-help'
  | 'admin'
  | 'cookbook'
  | 'projects'
  | 'personaregistry'
  | 'consulting'
  | 'devteam'
  | 'toolkit'
  | 'myagenticteams'
  | 'mcp'
  | 'status'
  | 'builds'
  // <gen:union> managed by scaffold-sites.py — do not edit by hand
  | 'community'
  | 'support'
  | 'help'
  | 'news'
  | 'academy'
  | 'dashboards'
  | 'recipes'
  | 'personas'
  | 'communities'
  | 'ecosystems'
  | 'registries'
  | 'storage'
  | 'customers'
  | 'products'
  | 'billing'
  | 'domains'
  | 'authentication'
  | 'sites'
  | 'devices'
  | 'notifications'
  | 'knowledgebases'
  | 'tools'
  | 'education'
  | 'teamregistry'
  | 'teambuilder'
  | 'codereviews'
  | 'personabuilder'
  | 'research'
  | 'consultants'
  // </gen:union>
  | 'learntruefacts'
  | 'narratives'
  // fishlamp / fishlampdesign: FishLamp Design, the studio that publishes the whole
  // family (the brand that replaced Agentic Developer Studio). Both domains serve the
  // same site. `external: true` — they are link-outs, not apps in this repo.
  | 'fishlamp'
  | 'fishlampdesign'
  // messaging: NOT a marketing site — an in-hub-only workspace feature (the DM /
  // notifications surface at /<slug>/messaging). Registered so HUB_FEATURE_SEGMENT can
  // key it and the feature's `siteId` resolves; hidden from the switcher (listed:false).
  | 'messaging'

export interface SiteDef {
  id: SiteId
  /** Name shown in the switcher dropdown list. Short by convention (e.g. "Hub",
   *  "Cookbook"). */
  label: string
  /** Full brand name shown as the header's current-site title (the switcher
   *  trigger), e.g. "Agentic Developer Team". Defaults to `label`. */
  fullLabel?: string
  /** Even shorter name for the footer interlink row; defaults to `label`. */
  shortLabel?: string
  /** Short tagline shown alongside the label in the switcher. */
  description?: string
  /** Production host, no protocol. testing/staging prepend `testing.`/`staging.`. */
  prodHost: string
  /** A `staging.<prodHost>` deployment exists. */
  hasStaging: boolean
  /** A `testing.<prodHost>` deployment exists. */
  hasTesting: boolean
  /** Site exposes the shared auth-gated /home route (drives route carry). */
  hasHome: boolean
  /** Shape of the site's authenticated WORKSPACE route — the path a cross-site
   *  switch carries the active workspace slug onto (see {@link siteWorkspaceHref}).
   *  The three shapes exist because the PR #197 rollout could not use one:
   *   - `'root'`   → `/<slug>`      — 33 sites (`app/[workspace]/[[...path]]`).
   *   - `'nested'` → `/home/<slug>` — cookbook, personaregistry, research, whose
   *     one-segment routes a root `/<slug>` would swallow.
   *   - `'hub'`    → `/<slug>/home` — the hub's own pre-existing shape.
   *  Absent ⇒ the site has NO workspace route, and a switch from a workspace
   *  falls back to its landing.
   *
   *  ⚠️ This is NOT derivable from `hasHome`, and must not be re-derived from it:
   *  `community` has a `/home` (hasHome: true) but no `[workspace]` route at all,
   *  so keying off `hasHome` would send every workspace switch to a 404. The
   *  values are stamped from the actual route tree and held to it by
   *  `registry.test.ts` ("workspaceRoute matches the route tree"). */
  workspaceRoute?: 'root' | 'nested' | 'hub'
  /** Part of the derived family roster ({@link LISTED_SITES}, and the footer
   *  interlinks under it). Defaults to true; set false to keep a site in the registry
   *  — so its own header still resolves a label and its pages keep serving — while
   *  leaving that roster.
   *
   *  ⚠️ It does NOT hide a site from the site menu, despite the name. That tree is
   *  hand-authored (`fleetMenuGroups.ts`) and names its rows one at a time, so a
   *  delisted site appears there exactly when someone wrote it in — which several do,
   *  on purpose. Delisting is about the roster, not about reachability. */
  listed?: boolean
  /** Render a divider above this entry in the switcher dropdown — used to set
   *  a site apart from the rest of the family. */
  dividerBefore?: boolean
  /** Opens a labelled group in the footer "sites overview" popover. Set on the
   *  FIRST entry of each group; following entries (without their own label) join
   *  it. Entries before the first labelled group render as an unlabelled lead. */
  sectionLabel?: string
  /** Marks the one entry that is the BRAND the family sits under (FishLamp
   *  Design), rather than a member of it. ⚠️ Declared intent only: nothing reads
   *  this today (the switcher menus are curated per-site props, not derived from
   *  the registry), so it renders as an ordinary row. Kept as the marker for
   *  whoever styles it. */
  featured?: boolean
  /** NOT an app in this repo — a link-out to a site we merely own (FishLamp
   *  Design). It is a normal entry in the footer "sites overview" and resolves
   *  through `buildSiteHref` like any other, but it never participates in
   *  cross-site SSO: `ssoReturnOrigins` excludes it, so its origin is never
   *  added to the central `adh` OAuth client's allowed-return list. Fail closed
   *  — an origin that can't complete an ADH login has no business being a legal
   *  `return` target. (It also has no `frontend/src/*` folder, so it is absent
   *  from MAIN_SITE_IDS/MARKETING_SITE_IDS and from the generated route map.) */
  external?: boolean
  /** Is a live, crawlable HTML site. Defaults to true; set false for hosts that
   *  aren't an indexable web page (e.g. the MCP server endpoint) so they're
   *  excluded from the SEO interlink row in the footer. */
  crawlable?: boolean
}

// Display order = switcher order, grouped into divider-separated sections:
//   1. bitbag — the Agentic Developer persona, set apart at the very top.
//   2. the core site family (hub … research).
//   3. consultants — the services CTA, its own section above the studio brand.
//   4. fishlamp — FishLamp Design, the studio the family sits under (marked
//      `featured`, currently unrendered), followed by its second domain.
//   5. admin + status + builds — the operational consoles, set apart at the end.
// `dividerBefore` on the first entry of a section draws the separator above it.
// learntruefacts stays in the registry (so its own header resolves a label) but
// is hidden from the switcher + footer via `listed: false`.
// There is no `studio` entry: FishLamp Design replaced Agentic Developer Studio
// and the studio app was deleted from the repo, so agenticdeveloper.studio and
// agenticdevelopmentstudio.com are no longer sites this family knows about. Both
// domains are dead — nothing redirects them at fishlamp.com. Do not re-add them.
export const SITES: SiteDef[] = [
  // --- bitbag: the ADH persona, its own section at the top. Opens the
  // "Core platform" group in the footer sites-overview popover. ---
  { id: 'bitbag', label: 'Bitbag', fullLabel: 'Bitbag', description: 'The Agentic Developer persona', prodHost: 'bitbag.ai', hasStaging: true, hasTesting: true, hasHome: false, sectionLabel: 'Core platform' },
  // --- the core site family ---
  { id: 'hub', label: 'Hub', fullLabel: 'Agentic Developer Hub', description: 'The Agentic Developer Hub', prodHost: 'agenticdeveloperhub.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'hub', dividerBefore: true },
  { id: 'cookbook', label: 'Cookbook', fullLabel: 'Agentic Developer Cookbook', description: 'Recipes & patterns', prodHost: 'agenticdevelopercookbook.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'nested' },
  { id: 'projects', label: 'Projects', fullLabel: 'Agentic Developer Projects', description: 'Project planning', prodHost: 'agenticdeveloperprojects.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'root' },
  // narratives: the ecosystem-story site at agenticdevelopernarratives.com
  // (deployed in a later phase). It's ALSO an in-hub feature workspace at
  // /<slug>/narratives (see HUB_FEATURE_SEGMENT + the [slug]/(workspace)/narratives
  // route, which auth-gates an iframe of the published static bundle) — a temporary bridge
  // until it's backed by the adh backend. Has testing+staging+production Vercel
  // tiers (hasTesting:true) so cross-site SSO allows testing.<domain>.
  // Its prod domain is live now, so it is crawlable (the default) and carries a
  // real description rather than its own host — it is a footer interlink like
  // every other content site.
  { id: 'narratives', label: 'Narratives', fullLabel: 'Agentic Developer Narratives', description: 'Ecosystem stories', prodHost: 'agenticdevelopernarratives.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'root' },
  { id: 'personaregistry', label: 'Persona Registry', fullLabel: 'Agentic Persona Registry', description: 'Browse agentic personas', prodHost: 'agenticpersonaregistry.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'nested' },
  { id: 'devteam', label: 'Team', fullLabel: 'Agentic Developer Team', description: 'Your agentic dev team', prodHost: 'agenticdeveloperteam.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'root' },
  { id: 'toolkit', label: 'Toolkit', fullLabel: 'Agentic Developer Toolkit', description: 'The developer toolkit', prodHost: 'agenticdevelopertoolkit.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'root' },
  // myagenticteams: off-pattern consumer brand (not agenticdeveloper<x>.com), so
  // `fullLabel` is required — siteHeaderTitle can't derive the brand from the host.
  { id: 'myagenticteams', label: 'My Teams', fullLabel: 'My Agentic Teams', description: 'Build your own agentic teams', prodHost: 'myagenticteams.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'root' },
  { id: 'mcp', label: 'MCP', fullLabel: 'Agentic Developer MCP', description: 'MCP server', prodHost: 'mcp.agenticdeveloperhub.com', hasStaging: true, hasTesting: false, hasHome: false, crawlable: false },
  // <gen:sites> managed by scaffold-sites.py — do not edit by hand
  { id: 'community', label: 'Community', fullLabel: 'Agentic Developer Community', description: 'Forums & discussion', prodHost: 'agenticdevelopercommunity.com', hasStaging: true, hasTesting: true, hasHome: true, dividerBefore: true, sectionLabel: 'Developer platform' },
  { id: 'support', label: 'Support', fullLabel: 'Agentic Developer Support', description: 'Get support', prodHost: 'agenticdevelopersupport.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'root' },
  // agenticdeveloperhelp.com — a landing-only site now (its guide/reference/chat surface moved to
  // help.adh.com, id 'hub-help'). listed:false: stays registered (its own header resolves, the
  // landing keeps serving and links across to hub-help), but every family "Help" link — switcher,
  // footer, story next-steps — points at hub-help instead. Mirrored in adh's `.shipr`
  // ([adh.sites.help]), which is what scaffold-sites.py generates this row from.
  { id: 'help', label: 'Help', fullLabel: 'Agentic Developer Help', description: 'Help topics', prodHost: 'agenticdeveloperhelp.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'root', listed: false },
  // help.adh.com — the consolidated SSR help surface (chat, quickstart, reference, rest-api, mcp,
  // hub), duplicated from the agenticdeveloperhelp.com app (id 'help') into frontend/src/sites/hub-help.
  // LISTED: this is the family's Help destination (the landing above is delisted). HAND-MANAGED
  // inside the gen block: adh's `.shipr` marks it `core`, not `generated`, so scaffold-sites.py
  // does not emit this row — and re-running that generator DELETES it. Restore it by hand.
  { id: 'hub-help', label: 'Help', fullLabel: 'Agentic Developer Hub Help', description: 'Help topics', prodHost: 'help.agenticdeveloperhub.com', hasStaging: true, hasTesting: true, hasHome: false },
  { id: 'news', label: 'News', fullLabel: 'Agentic Developer News', description: 'News & updates', prodHost: 'agenticdevelopernews.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'root' },
  { id: 'academy', label: 'Academy', fullLabel: 'Agentic Developer Academy', description: 'Learn agentic dev', prodHost: 'agenticdeveloperacademy.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'root' },
  { id: 'dashboards', label: 'Dashboards', fullLabel: 'Agentic Developer Dashboards', description: 'Status dashboards', prodHost: 'agenticdeveloperdashboards.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'root' },
  { id: 'recipes', label: 'Recipes', fullLabel: 'Agentic Developer Recipes', description: 'Developer recipes', prodHost: 'agenticdeveloperrecipes.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'root', listed: false },
  { id: 'personas', label: 'Personas', fullLabel: 'Agentic Developer Personas', description: 'Define your personas', prodHost: 'agenticdeveloperpersonas.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'root' },
  { id: 'communities', label: 'Communities', fullLabel: 'Agentic Developer Communities', description: 'Build communities', prodHost: 'agenticdevelopercommunities.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'root' },
  { id: 'ecosystems', label: 'Ecosystems', fullLabel: 'Agentic Developer Ecosystems', description: 'Build ecosystems', prodHost: 'agenticdeveloperecosystems.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'root' },
  { id: 'registries', label: 'Registries', fullLabel: 'Agentic Developer Registries', description: 'Build registries', prodHost: 'agenticdeveloperregistries.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'root' },
  { id: 'storage', label: 'Storage', fullLabel: 'Agentic Developer Storage', description: 'Manage storage', prodHost: 'agenticdeveloperstorage.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'root' },
  { id: 'customers', label: 'Customers', fullLabel: 'Agentic Developer Customers', description: 'Manage customers', prodHost: 'agenticdevelopercustomers.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'root' },
  { id: 'products', label: 'Products', fullLabel: 'Agentic Developer Products', description: 'Define products', prodHost: 'agenticdeveloperproducts.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'root' },
  { id: 'billing', label: 'Billing', fullLabel: 'Agentic Developer Billing', description: 'Customer billing', prodHost: 'agenticdeveloperbilling.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'root' },
  { id: 'domains', label: 'Domains', fullLabel: 'Agentic Developer Domains', description: 'Custom domains', prodHost: 'agenticdeveloperdomains.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'root' },
  { id: 'authentication', label: 'Authentication', fullLabel: 'Agentic Developer Authentication', description: 'Customer auth', prodHost: 'agenticdeveloperauthentication.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'root' },
  { id: 'sites', label: 'Sites', fullLabel: 'Agentic Developer Sites', description: 'Quick landing pages', prodHost: 'agenticdevelopersites.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'root' },
  { id: 'devices', label: 'Devices', fullLabel: 'Agentic Developer Devices', description: 'Connect devices', prodHost: 'agenticdeveloperdevices.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'root' },
  { id: 'notifications', label: 'Notifications', fullLabel: 'Agentic Developer Notifications', description: 'Send notifications', prodHost: 'agenticdevelopernotifications.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'root' },
  { id: 'knowledgebases', label: 'Knowledge Bases', fullLabel: 'Agentic Developer Knowledge Bases', description: 'Knowledge bases', prodHost: 'agenticdeveloperknowledgebases.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'root' },
  { id: 'tools', label: 'Tools', fullLabel: 'Agentic Developer Tools', description: 'Developer tools', prodHost: 'agenticdevelopertools.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'root' },
  { id: 'education', label: 'Education', fullLabel: 'Agentic Developer Education', description: 'Educational products', prodHost: 'agenticdevelopereducation.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'root', listed: false },
  { id: 'teamregistry', label: 'Team Registry', fullLabel: 'Agentic Team Registry', description: 'Register agentic teams', prodHost: 'agenticteamregistry.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'root' },
  { id: 'teambuilder', label: 'Team Builder', fullLabel: 'Agentic Team Builder', description: 'Build agentic teams', prodHost: 'agenticteambuilder.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'root' },
  { id: 'codereviews', label: 'Code Reviews', fullLabel: 'Agentic Developer Code Reviews', description: 'Code reviews', prodHost: 'agenticdevelopercodereviews.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'root' },
  { id: 'personabuilder', label: 'Persona Builder', fullLabel: 'Agentic Persona Builder', description: 'Configure personas', prodHost: 'agenticpersonabuilder.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'root' },
  { id: 'research', label: 'Research', fullLabel: 'Agentic Developer Research', description: 'Store & review research', prodHost: 'agenticdeveloperresearch.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'nested' },
  { id: 'consultants', label: 'Consultants', fullLabel: 'Agentic Development Consultants', description: 'Find consultants', prodHost: 'agenticdeveloperconsultants.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'root' },
  // </gen:sites>
  // --- consulting: FOLDED into the studio brand (brand-story-plan portfolio
  // pruning) — stays registered (its own header resolves, /details keep serving)
  // but it leaves the switcher + footer. ---
  { id: 'consulting', label: 'Consulting', description: 'Let us help you', prodHost: 'agenticdeveloperconsulting.com', hasStaging: true, hasTesting: true, hasHome: true, workspaceRoute: 'root', listed: false },
  // --- FishLamp Design: the studio the whole family sits under, and the name in
  // every footer's copyright. Featured (centered, gold, italic, name-only) in the
  // switcher; carries a description for the overview popover. Opens the
  // "Studio & consulting" group. Both domains serve the SAME site — fishlamp.com
  // is the canonical one, fishlampdesign.com the longer second door. `external`:
  // neither is an app in this repo, so neither joins the SSO return allowlist. ---
  { id: 'fishlamp', label: 'FishLamp Design', shortLabel: 'FishLamp', description: 'The studio behind the Hub', prodHost: 'fishlamp.com', hasStaging: false, hasTesting: false, hasHome: false, external: true, dividerBefore: true, sectionLabel: 'Studio & consulting', featured: true },
  { id: 'fishlampdesign', label: 'fishlampdesign.com', description: 'FishLamp Design — second domain', prodHost: 'fishlampdesign.com', hasStaging: false, hasTesting: false, hasHome: false, external: true },
  // --- operational consoles, their own section at the very end ---
  // admin is a wholly-authenticated console — its dashboard root IS its home,
  // so the switcher links it to '/' rather than a separate /home.
  { id: 'admin', label: 'Admin', fullLabel: 'Agentic Developer Admin', description: 'Operations console', prodHost: 'admin.agenticdeveloperhub.com', hasStaging: true, hasTesting: true, hasHome: false, dividerBefore: true, sectionLabel: 'Operations' },
  { id: 'status', label: 'Status', fullLabel: 'Agentic Developer Status', description: 'System status', prodHost: 'status.agenticdeveloperhub.com', hasStaging: true, hasTesting: true, hasHome: false },
  { id: 'builds', label: 'Builds', fullLabel: 'Agentic Developer Builds', description: 'Build status', prodHost: 'builder.agenticdeveloperhub.com', hasStaging: false, hasTesting: true, hasHome: false },
  // --- Registered but hidden from the switcher list ---
  { id: 'learntruefacts', label: 'Learn True Facts', description: 'learntruefacts.ai', prodHost: 'learntruefacts.ai', hasStaging: true, hasTesting: true, hasHome: false, listed: false },
  // messaging: an in-hub-only workspace feature (DMs + notifications), not a deployed
  // marketing site — no staging/testing/home tiers, hidden from the switcher + footer
  // (listed:false, like learntruefacts). Exists so the `messaging` feature's siteId and
  // HUB_FEATURE_SEGMENT entry resolve to a real registry site.
  { id: 'messaging', label: 'Messaging', fullLabel: 'Agentic Developer Messaging', description: 'Direct messages & notifications', prodHost: 'agenticdevelopermessaging.com', hasStaging: false, hasTesting: false, hasHome: false, listed: false },
]

/** The family roster — every site that counts as a public member of the family, in
 *  display order. What consumes it is the footer/overview surfaces below; the site
 *  menu does NOT (see {@link SiteDef.listed}). */
export const LISTED_SITES: SiteDef[] = SITES.filter((s) => s.listed !== false)

/** The crawlable sites to interlink from the footer, in display order. The roster
 *  above minus non-HTML endpoints (e.g. the MCP server). These render as real
 *  server-side `<a href>` links to absolute production hosts so search engines can
 *  follow them between properties. */
export const FOOTER_SITES: SiteDef[] = LISTED_SITES.filter((s) => s.crawlable !== false)

export function getSite(id: SiteId): SiteDef | undefined {
  return SITES.find((s) => s.id === id)
}

/** The two physical site families — the ids whose Next app folders live under
 *  `websites/main/` and `websites/marketing/`. The dev-only site-menu submenus
 *  ("Main sites" / "Marketing sites", shown only in staging/testing/local — see
 *  {@link ../header/debugSiteGroups}) link every one to its deployment in the
 *  CURRENT env, so a developer can jump straight to any site's build. The folders
 *  are the source of truth; a registry test asserts these arrays match them
 *  exactly, so a newly-scaffolded site can't silently drop out of the menu.
 *  Alphabetical, mirroring the directory listing. `mcp` / `builds` / `messaging`
 *  have no site folder (an endpoint / a backend / an in-hub feature), so they're
 *  in neither list. */
export const MAIN_SITE_IDS: SiteId[] = [
  'admin', 'bitbag', 'community', 'cookbook', 'devteam', 'help', 'hub', 'hub-help',
  'learntruefacts', 'myagenticteams', 'news', 'personaregistry', 'status', 'support', 'toolkit',
]
export const MARKETING_SITE_IDS: SiteId[] = [
  'academy', 'authentication', 'billing', 'codereviews', 'communities', 'consultants', 'consulting',
  'customers', 'dashboards', 'devices', 'domains', 'ecosystems', 'education', 'knowledgebases',
  'narratives', 'notifications', 'personabuilder', 'personas', 'products', 'projects', 'recipes',
  'registries', 'research', 'sites', 'storage', 'teambuilder', 'teamregistry', 'tools',
]

/** Sensible groupings for the site menu + footer overview, in display order.
 *  Order-independent of the SITES array (the scaffolded sites live in one gen
 *  block), so grouping is by membership here. Every listed site should appear in
 *  exactly one category (guarded by a test); supersedes the per-entry
 *  `dividerBefore`/`sectionLabel` hints for these two surfaces. */
export const SITE_CATEGORIES: { label: string; ids: SiteId[] }[] = [
  {
    label: 'Develop',
    ids: ['bitbag', 'hub', 'cookbook', 'projects', 'narratives', 'devteam', 'toolkit', 'mcp', 'codereviews', 'research'],
  },
  {
    label: 'Build',
    ids: ['personas', 'personabuilder', 'personaregistry', 'registries', 'teamregistry', 'teambuilder', 'myagenticteams', 'ecosystems', 'knowledgebases', 'storage', 'tools', 'sites', 'domains', 'authentication', 'devices', 'notifications', 'dashboards'],
  },
  { label: 'Sell', ids: ['products', 'customers', 'billing'] },
  {
    label: 'Learn & community',
    ids: ['academy', 'news', 'community', 'communities', 'hub-help', 'support'],
  },
  // consultants sits with the studio brand; admin + status are their own consoles
  // section last — their previous groupings. (education/recipes/consulting are
  // folded — registered but delisted.)
  { label: 'Studio & consulting', ids: ['consultants', 'fishlamp', 'fishlampdesign'] },
  { label: 'Operations', ids: ['admin', 'status', 'builds'] },
]

export type SiteGroup = { label: string; sites: SiteDef[] }

/** Partition `sites` into the SITE_CATEGORIES groups, in category + member order,
 *  dropping empty groups. Anything not categorized lands in a trailing "More"
 *  group so a new site is never silently dropped from the menu. */
export function groupSitesByCategory(sites: SiteDef[]): SiteGroup[] {
  const byId = new Map(sites.map((s) => [s.id, s]))
  const used = new Set<SiteId>()
  const groups: SiteGroup[] = []
  for (const cat of SITE_CATEGORIES) {
    const members: SiteDef[] = []
    for (const id of cat.ids) {
      const s = byId.get(id)
      if (s) {
        members.push(s)
        used.add(id)
      }
    }
    if (members.length) groups.push({ label: cat.label, sites: members })
  }
  const leftover = sites.filter((s) => !used.has(s.id))
  if (leftover.length) groups.push({ label: 'More', sites: leftover })
  return groups
}

/** The brand name shown in the header (the switcher trigger). Rule: any site on
 *  an `agenticdeveloper<x>.com` apex domain reads "Agentic Developer <X>",
 *  derived from the host so it's automatic for every such site (e.g.
 *  agenticdeveloperconsulting.com → "Agentic Developer Consulting"). An explicit
 *  `fullLabel` always wins (for off-pattern brands like the Persona Registry or
 *  Bitbag); otherwise we fall back to `label`. */
export function siteHeaderTitle(site: SiteDef): string {
  if (site.fullLabel) return site.fullLabel
  const rest = /^agenticdeveloper([a-z0-9-]+)\.com$/.exec(site.prodHost)?.[1]
  if (rest) {
    return `Agentic Developer ${rest.charAt(0).toUpperCase()}${rest.slice(1)}`
  }
  return site.label
}

/** The brand prefix the hero/graph render in plain weight, with the trailing
 *  word(s) accented (gold italic). */
const TITLE_PREFIX = 'Agentic Developer'

/** Split a site's brand title into the plain "Agentic Developer" lead + the
 *  accent word(s). Sites on the `agenticdeveloper<x>.com` pattern split into
 *  lead "Agentic Developer" + accent "<X>"; an off-pattern brand (e.g. the
 *  Persona Registry) has no lead and the whole name is the accent. The single
 *  source of truth for the SiteLanding/MarketingLanding + LandingGraph title
 *  shape — both render `{titleLead} <i>{titleAccent}</i>`. */
export function splitSiteTitle(site: SiteDef): { titleLead: string; titleAccent: string } {
  const full = siteHeaderTitle(site)
  if (full.startsWith(`${TITLE_PREFIX} `)) {
    return { titleLead: TITLE_PREFIX, titleAccent: full.slice(TITLE_PREFIX.length + 1) }
  }
  return { titleLead: '', titleAccent: full }
}

export type SiteEnv = 'production' | 'staging' | 'testing' | 'local'

/** Hash appended to switcher links so a target site's not-found page knows to
 *  walk the path up to the nearest existing route instead of showing a 404. */
export const SITE_SWITCH_HASH = '#site-switch'

/** Classify the current environment from a hostname (no protocol/port). */
export function detectEnv(hostname: string): SiteEnv {
  const host = hostname.toLowerCase().replace(/:\d+$/, '')
  if (
    host === 'localhost' ||
    host.startsWith('127.') ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.endsWith('.localhost')
  ) {
    return 'local'
  }
  if (host.startsWith('testing.')) return 'testing'
  if (host.startsWith('staging.')) return 'staging'
  return 'production'
}

/** Resolve the host for a target site in a given env, falling back
 *  testing → staging → production when the target lacks that env. */
function hostForEnv(site: SiteDef, env: SiteEnv): string {
  if (env === 'testing') {
    if (site.hasTesting) return `testing.${site.prodHost}`
    if (site.hasStaging) return `staging.${site.prodHost}`
    return site.prodHost
  }
  if (env === 'staging') {
    return site.hasStaging ? `staging.${site.prodHost}` : site.prodHost
  }
  return site.prodHost
}

/** Build the local-dev origin for a target site from the current host. Two local
 *  schemes are supported:
 *
 *   - `dev.local` suite (the `dev.local suite` dev server): the hub apex is
 *     `<suite>.dev.local` and every other site is `<id>.<suite>.dev.local`,
 *     where `<suite>` is `hub` on main and `hub-<branch>` on other worktrees.
 *     Mirrors the routing in `dev.local/suite.toml` (apex = 'hub'); change both
 *     together.
 *   - bare `localhost` (single-site `next dev`, optionally carrying a port, e.g.
 *     "admin.localhost:5171"): hub is the bare apex, others are `<id>.localhost`. */
function localOrigin(target: SiteDef, currentHost: string): string {
  const sub = target.id === 'hub' ? '' : `${target.id}.`
  const host = currentHost.toLowerCase().replace(/:\d+$/, '')
  if (host.endsWith('.dev.local')) {
    // Current host is `<suite>.dev.local` (apex) or `<id>.<suite>.dev.local`
    // (child). `<suite>` is a single DNS label, so it's the label immediately
    // before `.dev.local` (robust even if a deeper subdomain ever appears).
    const base = host.slice(0, -'.dev.local'.length)
    const suite = base.slice(base.lastIndexOf('.') + 1)
    return `https://${sub}${suite}.dev.local`
  }
  const port = currentHost.match(/:(\d+)$/)?.[1]
  const suffix = port ? `:${port}` : ''
  return `http://${sub}localhost${suffix}`
}

/** Map the current path onto the path to open on the target site.
 *  Only `/` and `/home` are guaranteed to exist on every chrome site, so:
 *   - root and site-specific deep routes → the target's landing `/`
 *   - `/home` (or `/home/*`) → the target's `/home`; deep `/home/*` routes
 *     carry the marker so the target up-walks if the exact route is missing. */
function carryPath(target: SiteDef, pathname: string): string {
  const path = pathname || '/'
  if (path === '/home' || path.startsWith('/home/')) {
    if (!target.hasHome) return '/'
    if (path === '/home') return '/home'
    return `${path}${SITE_SWITCH_HASH}`
  }
  return '/'
}

/** Build the absolute href to switch to `target` from the current location,
 *  preserving the environment and matching route per the rules above. */
export function buildSiteHref(target: SiteDef, currentHostname: string, pathname: string): string {
  const env = detectEnv(currentHostname)
  if (env === 'local') return `${localOrigin(target, currentHostname)}${carryPath(target, pathname)}`
  const host = hostForEnv(target, env)
  return `https://${host}${carryPath(target, pathname)}`
}

// ---------------------------------------------------------------------------
// Hub workspace routes (hand-managed — NOT scaffolded; keep outside gen blocks).
//
// Each developer-feature site also has a view INSIDE the hub, under the active
// workspace slug at `/<slug>/<feature>` (e.g. the Storage site's hub view is
// `/<slug>/storage`). This maps the site to that segment.
//
// It is no longer a switch TARGET: the site menu is a cross-site navigator, so a
// switch from a workspace lands on the site's OWN workspace route
// ({@link siteWorkspaceHref}), never the hub's view of it. What this table is for
// now is the other direction — naming which second segments of a hub path ARE
// workspace routes, via {@link HUB_WORKSPACE_SEGMENTS}, which is how the menu knows
// there is a workspace to carry at all.
//
// Values are bare feature SEGMENTS (no leading slash).
export const HUB_FEATURE_SEGMENT: Partial<Record<SiteId, string>> = {
  dashboards: 'dashboards',
  // The persona-data CRUD workspace lives at /<slug>/all-data (the /<slug>/personas
  // route is the persona editor); the 'personas' registry site switches into this view.
  personas: 'all-data',
  communities: 'communities',
  messaging: 'messaging',
  // Ecosystems are managed as PRODUCTS in the hub (/<slug>/products — each product IS
  // an ecosystem), so both the ecosystems and products sites switch into that view.
  ecosystems: 'products',
  products: 'products',
  storage: 'storage',
  billing: 'billing',
  knowledgebases: 'knowledgebases',
  narratives: 'narratives',
  research: 'research',
}

/** Hub workspace feature segments with no DISTINCT registry site behind them:
 *  recognized as workspace routes (so the menu reads a slug to carry) but absent from
 *  HUB_FEATURE_SEGMENT, which is keyed by site. teams + projects are bespoke workspace
 *  features with no registry site of their own. `personas` is the persona-EDITOR route
 *  (`/<slug>/personas`), a first-class workspace route; the `personas` registry site's
 *  hub view is the persona-DATA CRUD at `/<slug>/all-data` (see HUB_FEATURE_SEGMENT),
 *  so `personas` lives here — one segment cannot map to two sites — and is recognized
 *  by isHubWorkspacePath all the same. That keeps the switcher/drawer in step with the
 *  app header, which treats /<slug>/personas as a workspace route via FEATURE_META. */
const HUB_EXTRA_FEATURE_SEGMENTS: string[] = [
  'teams', 'projects', 'personas', 'persona-services', 'tokens', 'integrations', 'members', 'settings',
  // Ecosystem topics + LLM Providers promoted onto the root workspace rail (each is a
  // `/<slug>/<segment>` route with a FEATURE_META entry, no distinct registry site to
  // switch into) — kept lockstep with FEATURE_META by the reverse-lockstep test (#9).
  'applications', 'invitations', 'signin-apps', 'gamification', 'auth', 'feature-flags',
  'server-bags', 'llm-providers',
  // Email Signup: a bespoke rail route (audience.* lists/templates/campaigns), no
  // distinct registry site of its own — same lockstep as the row above.
  'email-signup',
]

// The set of second-path segments that mark a hub workspace route. Object.values
// of a Partial record is (string | undefined)[] under strict mode, so the
// type-guard filter is required to narrow. Plus `home` (the workspace landing).
// Exported as the single source of truth for "is this a hub workspace segment?":
// useSiteMenu's routeHref guards on it (#8) and the hub's workspace-features
// reverse-lockstep test asserts every segment maps to a known feature (#9).
export const HUB_WORKSPACE_SEGMENTS = new Set<string>([
  'home',
  ...HUB_EXTRA_FEATURE_SEGMENTS,
  ...Object.values(HUB_FEATURE_SEGMENT).filter((s): s is string => s !== undefined),
])

/** True when `pathname` is inside the hub's authenticated workspace — a
 *  `/<slug>/<home|feature>` route (or deeper). Also true for the slug-less
 *  workspace shell routes `/home`, `/home/settings`
 *  (segs[0] === 'home'), so the switcher keeps the in-hub menu there even though
 *  there's no slug segment to read (useSiteMenu falls back to the personal slug).
 *  Drives the switcher's in-hub mode; only meaningful on the hub itself. */
export function isHubWorkspacePath(pathname: string): boolean {
  const segs = (pathname || '/').split('/').filter(Boolean)
  if (segs[0] === 'home') return true
  return segs.length >= 2 && HUB_WORKSPACE_SEGMENTS.has(segs[1]!)
}

/** Extract the active workspace slug from a hub workspace pathname, or null when
 *  `pathname` isn't a `/<slug>/<home|feature>` route. */
export function hubWorkspaceSlug(pathname: string): string | null {
  const segs = (pathname || '/').split('/').filter(Boolean)
  return segs.length >= 2 && HUB_WORKSPACE_SEGMENTS.has(segs[1]!) ? segs[0]! : null
}

/** The path of `target`'s OWN authenticated workspace, scoped to `slug` — the
 *  destination the site menu carries a signed-in visitor to when they switch
 *  sites from a workspace route, so they land in the SAME workspace on the site
 *  they picked. Returns undefined when `target` has no workspace route, and the
 *  caller falls back to the site's landing.
 *
 *  It sends the visitor to the SITE, never to the hub's own view of that site's
 *  feature (`/<slug>/<feature>`, see HUB_FEATURE_SEGMENT): the menu is a cross-site
 *  navigator, and picking "Storage" from it means the Storage site.
 *  The shape per site comes from {@link SiteDef.workspaceRoute}. */
export function siteWorkspaceHref(target: SiteDef, slug: string): string | undefined {
  if (!slug) return undefined
  switch (target.workspaceRoute) {
    case 'root':
      return `/${slug}`
    case 'nested':
      return `/home/${slug}`
    case 'hub':
      return `/${slug}/home`
    default:
      return undefined
  }
}

/** The top-level path segments a `workspaceRoute: 'root'` site owns that are NOT a
 *  workspace slug. Those sites put their workspace at `/<slug>`, so its segment sits
 *  in the same position as every public page they ship — this is the set that tells
 *  the two apart, and it is exactly the static top-level routes those 33 sites have
 *  (asserted against the generated route map by registry.test's lockstep case, so a
 *  page added at a site's root fails there until it is listed here).
 *
 *  Only the STATIC ones can be listed, so an unknown segment (`/typo`) reads as a
 *  workspace slug. That is deliberate rather than tolerated: a slug the destination
 *  cannot resolve is repaired on arrival by `useWorkspaceRoute`, which replaces an
 *  unknown slug with the user's real workspace. A wrong guess here costs a redirect;
 *  the alternative — refusing to carry any slug — costs the carry on every site. */
export const SITE_LANDING_SEGMENTS = new Set<string>([
  'auth',
  'demo',
  'details',
  'home',
  'privacy',
  'terms',
  'tour',
])

/** The workspace slug `pathname` names on `site`, or null when it names none — the
 *  exact inverse of {@link siteWorkspaceHref}, and what the site menu reads to carry
 *  the visitor's CURRENT workspace across a site switch.
 *
 *  Only meaningful for an authenticated visitor: every workspace route in the family
 *  sits behind an auth gate, so a signed-out path that happens to parse is not one.
 *  The caller owns that check (see useSiteMenu). */
export function siteWorkspaceSlug(site: SiteDef, pathname: string): string | null {
  const segs = (pathname || '/').split('/').filter(Boolean)
  switch (site.workspaceRoute) {
    case 'hub':
      return hubWorkspaceSlug(pathname)
    case 'nested':
      return segs[0] === 'home' && segs[1] ? segs[1] : null
    case 'root':
      return segs[0] && !SITE_LANDING_SEGMENTS.has(segs[0]) ? segs[0] : null
    default:
      return null
  }
}

/** Resolve an absolute URL to a specific path on another site, in the current
 *  environment (testing/staging/production/local), e.g. the shared login/join
 *  pages that live on the hub. Unlike buildSiteHref this carries the exact path
 *  rather than route-matching, so it suits fixed destinations like `/login`. */
/**
 * A persona's public profile URL on the registry. `siteUrl` resolves the right host for the
 * current environment (local suite / testing / staging / prod); the bare `/<slug>` resolves
 * when the slug is unique system-wide. Only reachable once the persona is saved with
 * public/unlisted visibility. Lives HERE (not in a host) because every host that links a
 * profile — the hub's persona surfaces AND the personabuilder site's mount — must mint the
 * SAME URL; two copies of this rule already drifted once into review findings.
 */
export function personaProfileUrl(slug: string): string {
  // globalThis, not `window`: this file is also typechecked by the backend (no dom lib),
  // where a bare `window` reference is TS2304 even behind a typeof guard.
  const hostname = (globalThis as { location?: { hostname?: string } }).location?.hostname ?? "";
  return siteUrl("personaregistry", `/${encodeURIComponent(slug)}`, hostname);
}

export function siteUrl(id: SiteId, path: string, currentHostname: string): string {
  const site = getSite(id)
  if (!site) return path
  const env = detectEnv(currentHostname)
  if (env === 'local') return `${localOrigin(site, currentHostname)}${path}`
  return `https://${hostForEnv(site, env)}${path}`
}

/** Production host for a site, used as the deterministic SSR default before the
 *  client knows its own hostname (avoids hydration mismatch on auth links). */
export function siteProdUrl(id: SiteId, path: string): string {
  const site = getSite(id)
  if (!site) return path
  return `https://${site.prodHost}${path}`
}

/** The post-login landing PATH for a site: its `/home` when it exposes one
 *  (`hasHome`), else the site root `/`. This is the default "come back here"
 *  target the header's Login / Sign up buttons pass to the hub as `?return=`, so a
 *  visitor lands back on the site they started from rather than the hub's own
 *  /home. See docs/platform/login-and-return.md. */
export function siteHomePath(id: SiteId): string {
  return getSite(id)?.hasHome ? '/home' : '/'
}

/** The brand origins a given backend environment must allow as OAuth `return`
 *  targets for the central `adh` cross-site-SSO client. Every brand site begins
 *  login by navigating to the shared Authorization Server with
 *  `return=https://<this site>/auth/callback`; the backend only honors a return
 *  whose origin is on the `adh` client's allowlist, so the seeder feeds it this
 *  list.
 *
 *  Each Vercel project talks ONLY to its same-env backend, so an env's allowlist
 *  needs exactly the origins that can reach that env: production = every site;
 *  staging = sites with a staging deploy; testing = sites with a testing deploy.
 *  A site with no deploy in `env` is reached via the testing→staging fallback on
 *  a DIFFERENT env's host (see `hostForEnv`), so its origin never hits this env's
 *  backend and is intentionally absent here.
 *
 *  `external` sites (FishLamp Design) are excluded from EVERY env: they are
 *  link-outs, not ADH apps — they have no `/auth/callback` and never begin an
 *  ADH login, so listing them would widen the OAuth redirect surface for nothing. */
export function ssoReturnOrigins(env: 'production' | 'staging' | 'testing'): string[] {
  const prefix = env === 'production' ? '' : `${env}.`
  return SITES.filter(
    (s) =>
      !s.external &&
      (env === 'production' ? true : env === 'staging' ? s.hasStaging : s.hasTesting),
  ).map((s) => `https://${prefix}${s.prodHost}`)
}
