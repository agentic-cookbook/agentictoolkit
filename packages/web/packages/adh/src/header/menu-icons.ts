// Single source of truth for site-menu row icons.
//
// Every row in the site menu (SiteMenu → NavigationPopover) resolves its icon
// through THIS map — never a hard-coded icon at a render site. Keys are:
//   - a SiteId (for `{ site }` menu links): 'hub', 'bitbag', …
//   - an in-hub route path (for `{ route }` links): '/products', '/personas', …
//   - a chrome key (for the non-site rows): 'home', 'workspaces', 'recents',
//     'login', 'signup', 'routes', 'debug'.
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
  BadgeCheck,
  Bell,
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
  Code,
  Contact,
  CreditCard,
  Fingerprint,
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
  LayoutDashboard,
  LayoutTemplate,
  Library,
  LifeBuoy,
  LogIn,
  MonitorSmartphone,
  Network,
  Newspaper,
  NotebookText,
  Package,
  Route,
  School,
  ScrollText,
  ShieldCheck,
  Sparkles,
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
  community: Users, // matches FEATURE_META `communities`
  personaregistry: UserCircle, // matches FEATURE_META `personas`
  toolkit: Wrench, // matches the myagenticteams landing's toolkit glyph
  cookbook: ChefHat, // recipes/cookbook
  devteam: UsersRound, // matches FEATURE_META `teams`
  myagenticteams: Sparkles, // matches the myagenticteams landing
  narratives: ScrollText, // matches FEATURE_META `narratives`
  help: CircleHelp, // matches SiteMenu's existing help affordance
  'hub-help': CircleHelp, // the promoted family Help site (help.adh.com)
  news: Newspaper,

  // --- In-hub destination rows (logged-in only), keyed by route path ---
  '/products': Network, // matches FEATURE_META `products` (Products replaced /ecosystems)
  '/personas': UserCircle, // matches FEATURE_META `personas`
  '/organizations': Building, // matches WorkspaceShell's organization type icon
  '/research': FlaskConical, // matches FEATURE_META `research`

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
  learntruefacts: BadgeCheck, // "true facts"
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
  communities: Users, // matches FEATURE_META `communities`
  consultants: Briefcase,
  consulting: Handshake, // services CTA
  customers: Contact,
  dashboards: LayoutDashboard, // matches FEATURE_META `dashboards`
  devices: MonitorSmartphone,
  domains: Globe,
  ecosystems: Network, // matches FEATURE_META `ecosystems` (+ the '/ecosystems' route)
  education: School,
  knowledgebases: BookOpen, // matches FEATURE_META `knowledgebases`
  notifications: Bell,
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
