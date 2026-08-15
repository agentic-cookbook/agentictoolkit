// Single source of truth for site-menu row icons.
//
// Every row in the site menu (SiteMenu → NavigationPopover) resolves its icon
// through THIS map — never a hard-coded icon at a render site. Keys are:
//   - a SiteId (for `{ site }` menu links): 'hub', 'bitbag', …
//   - a hub route path: '/contact' and '/details' for the fleet tree's two
//     `{ route }` links, and one per hub WORKSPACE feature ('/storage',
//     '/personas', …) for the Recents rows, which key each recorded place by the
//     feature route it sits under.
//   - a chrome key (for the non-site rows): 'home', 'workspaces', 'recents',
//     'login', 'signup', 'routes', 'debug'.
//   - a fleet-menu key (`iconKey`), for the rows the registry cannot name: the
//     grouping topics that are no single site ('plan', 'build'), the topic that
//     deliberately does not wear its own site's glyph ('learn'), and the one
//     destination with no registry entry at all ('registry'). See fleetMenuGroups.
//
// Icons reuse the glyph the platform already associates with the thing wherever
// one exists (feature icons from hub `FEATURE_META`, the workspace type icons,
// the help affordance), so the menu matches the rest of the site; the remainder
// are chosen to read clearly and are safe to adjust here in the one place.
//
// The whole SiteId space is mapped — not just the sites promoted into the Hub
// core — because the dev-only "Marketing sites" / "Main sites" submenus list every
// site under `websites/{marketing,main}/` (MARKETING_SITE_IDS / MAIN_SITE_IDS), and
// each of those rows resolves its icon here too. A missing key just leaves the slot
// empty, so every family id carries one below.

import {
  Activity,
  AppWindow,
  BadgeCheck,
  Bell,
  Blocks,
  BookMarked,
  BookOpen,
  BookText,
  BookUser,
  Bot,
  Boxes,
  Briefcase,
  Bug,
  Building,
  ChefHat,
  CircleHelp,
  ClipboardList,
  Code,
  Contact,
  CreditCard,
  Database,
  Fingerprint,
  Flag,
  FlaskConical,
  FolderKanban,
  GitPullRequest,
  Globe,
  GraduationCap,
  Hammer,
  Handshake,
  HardDrive,
  Hexagon,
  History,
  House,
  KeyRound,
  LayoutDashboard,
  LayoutGrid,
  LayoutTemplate,
  Library,
  LifeBuoy,
  Lightbulb,
  LogIn,
  Mail,
  MessageCircle,
  MonitorSmartphone,
  Network,
  Newspaper,
  NotebookPen,
  NotebookText,
  Package,
  Plug,
  Route,
  School,
  ScrollText,
  Server,
  Settings,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserCircle,
  UserCog,
  UserPlus,
  Users,
  UsersRound,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

/** entry key → icon. See the module comment for the key scheme. */
export const MENU_ICONS: Record<string, LucideIcon> = {
  // --- Hub + its ecosystem sites (inline sub-items under Hub) ---
  hub: Hexagon,
  bitbag: Bot, // the hub's AI persona
  community: Users, // the community site; the hub has no communities feature to match
  personaregistry: UserCircle, // matches FEATURE_META `personas`
  toolkit: Wrench, // matches the myagenticteams landing's toolkit glyph
  cookbook: ChefHat, // recipes/cookbook
  devteam: UsersRound, // matches FEATURE_META `teams`
  myagenticteams: Sparkles, // matches the myagenticteams landing
  narratives: ScrollText, // matches FEATURE_META `narratives`
  help: CircleHelp, // matches SiteMenu's existing help affordance
  'hub-help': CircleHelp, // the promoted family Help site (help.adh.com)
  news: Newspaper,

  // --- Destination rows keyed by route path ---
  // The two that moved out of hub's header bar keep the glyph they wore there, so a
  // visitor who knew them in the bar recognizes them in the menu. '/details' is
  // resolved per-SITE rather than on the hub (see SiteMenu) — the key is still the
  // route, because that is what the row points at on whichever site renders it.
  '/contact': Mail,
  '/details': LayoutGrid,

  // --- Hub WORKSPACE feature routes, for the Recents rows -----------------------
  // Recents keys each recorded place by the feature route it sits under
  // (`/<slug>/personas` → '/personas'), so this block must cover EVERY hub workspace
  // segment: a key that resolves to nothing renders a blank icon slot beside rows
  // that have one, which is how Recents came to be the only inconsistently-iconed
  // block in the menu. It is the whole of HUB_WORKSPACE_SEGMENTS minus `home` (the
  // menu's own permanent row, never recorded) — held to that by the hub's
  // recents-recorder test, which walks the registry set and resolves each one here.
  //
  // Each glyph is the one hub's own FEATURE_META gives that feature, so a place looks
  // the same in the menu as it does on the workspace rail it was visited from.
  '/all-data': Database,
  '/applications': AppWindow,
  '/auth': KeyRound,
  '/billing': CreditCard,
  '/dashboards': LayoutDashboard,
  '/email-signup': Mail,
  '/feature-flags': Flag,
  '/gamification': Trophy,
  '/integrations': Plug,
  '/invitations': UsersRound,
  '/knowledgebases': BookOpen,
  '/llm-providers': Boxes,
  '/members': BookUser,
  '/messaging': MessageCircle,
  '/narratives': ScrollText,
  '/persona-services': Boxes,
  '/personas': UserCircle,
  '/products': Package,
  '/projects': FolderKanban,
  '/registries': Library, // matches FEATURE_META `registries`
  '/research': FlaskConical,
  '/server-bags': Server,
  '/settings': Settings,
  '/signin-apps': LogIn,
  '/storage': HardDrive,
  '/teams': UsersRound,
  '/tokens': KeyRound,

  // --- Fleet-menu rows the registry cannot name (see fleetMenuGroups) ---
  // The two grouping topics, which are no single site: a checklist for the things
  // you decide before writing anything, blocks for the things you assemble after.
  plan: ClipboardList,
  build: Blocks,
  // The one fleet destination with no registry entry at all: the family has no
  // consultant-registry site, so Hire ▸ Registry is an absolute href that keys its
  // own icon here (see fleetMenuGroups). Its three former neighbours — orgs,
  // notebook and integrations — became registry sites, so they are keyed by site id
  // among the marketing family below.
  registry: BookMarked, // hire's consultant registry
  // The "Learn" topic. Not the `help` site's glyph, which its own row inside that
  // submenu already wears — a topic that duplicates one of its children's icons
  // reads as that child promoted, rather than as the group it is.
  learn: Lightbulb,

  // --- Chrome rows (the auth-conditional top section, + the dev-only tools
  //     appended after the Marketing/Main sites submenus) ---
  home: House,
  workspaces: Boxes,
  recents: History,
  login: LogIn,
  signup: UserPlus,
  routes: Route,
  debug: Bug,

  // --- Remaining MAIN family sites (websites/main/), for the dev "Main sites"
  //     submenu. The rest of the family (hub, bitbag, community, cookbook,
  //     devteam, help, myagenticteams, news, personaregistry, toolkit) is mapped
  //     among the Hub-core rows above. ---
  admin: ShieldCheck, // operations console
  api: Code,
  docs: BookText, // guides & API reference
  status: Activity, // system status / pulse
  support: LifeBuoy,

  // --- MARKETING family sites (websites/marketing/), for the dev "Marketing
  //     sites" submenu. Where a site mirrors a hub feature, it reuses the
  //     FEATURE_META glyph so the menu matches the workspace rail. ('narratives'
  //     is mapped among the Hub-core rows above.) ---
  academy: GraduationCap,
  authentication: Fingerprint, // customer auth / identity
  billing: CreditCard, // matches FEATURE_META `billing`
  codereviews: GitPullRequest,
  communities: Users, // marketing site only — the hub route was removed
  consultants: Briefcase,
  consulting: Handshake, // services CTA
  customers: Contact,
  dashboards: LayoutDashboard, // matches FEATURE_META `dashboards`
  devices: MonitorSmartphone,
  domains: Globe,
  ecosystems: Network, // matches FEATURE_META `ecosystems` (+ the '/ecosystems' route)
  education: School,
  gamification: Trophy, // matches the '/gamification' route
  integrations: Plug, // matches the '/integrations' route
  knowledgebases: BookOpen, // matches FEATURE_META `knowledgebases`
  notebook: NotebookPen, // "Notes" in the fleet menu
  notifications: Bell,
  orgs: Building, // "Organizations" in the fleet menu
  personabuilder: UserCog, // configure personas
  personas: UserCircle, // matches FEATURE_META `personas` (+ the '/personas' route)
  products: Package,
  projects: FolderKanban, // matches FEATURE_META `projects`
  recipes: NotebookText,
  registries: Library,
  research: FlaskConical, // matches FEATURE_META `research` (+ the '/research' route)
  sites: LayoutTemplate, // quick landing pages
  storage: HardDrive,
  teambuilder: UsersRound, // matches FEATURE_META `teams`
  teamregistry: BookUser, // a directory of teams
  tools: Hammer,
}

/** Resolve a menu row's icon by its entry key, or undefined if none is mapped
 *  (the renderer leaves the icon slot empty rather than guessing). */
export function menuIcon(key: string | undefined): LucideIcon | undefined {
  return key ? MENU_ICONS[key] : undefined
}
