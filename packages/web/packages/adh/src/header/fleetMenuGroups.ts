import { type MenuGroup, type MenuLink } from './SiteMenu'

// ─────────────────────────────────────────────────────────────────────────────
// The fleet tree — the whole family as nine rows, used identically by BOTH the
// marketing (logged-out) and workspace (logged-in) menus. Nothing here is
// auth-conditional: every row is a site anyone may visit, and the rows that DO
// depend on a session (Home, Workspaces, Recents, Login/Sign up) are the chrome
// {@link SiteMenu} builds around this — Recents at the head of this very block.
//
// Shape: seven of the nine open a submenu, and five of those seven are a link as
// well — "Hub" opens the hub's own pages and IS the hub. The other two ('Plan',
// 'Build') are grouping headers with nowhere of their own to go, because the
// family has no plan.* or build.* site; they exist to give the sites underneath
// them a name. The remaining two rows (Bitbag, Organizations) are plain
// destinations with nothing under them.
//
// Every row carries an icon and a short trailing tagline. A `{ site }` row takes
// both from the registry unless it says otherwise here, so this file states a
// label or a description only where the registry's would read wrong IN A MENU —
// restating the registry's copy is how the two drift.
//
// The whole tree sits in ONE section (1), so it reads as a single block with one
// divider above it (the chrome, section 0) and one below (the dev tail, section 2).

/** The section every fleet row carries. See the module comment. */
export const FLEET_SECTION = 1

/** A top-level row that is a destination and nothing else. `blurb` surfaces its
 *  description as the trailing tagline, matching every other row. */
function leaf(link: MenuLink): MenuGroup {
  return { kind: 'leaf', section: FLEET_SECTION, blurb: true, link }
}

/** A top-level row that opens a flyout. `link` makes the trigger a destination
 *  too (click navigates, hover/→ still opens); omit it for a grouping header. */
function topic(t: {
  label: string
  description: string
  iconKey?: string
  link?: MenuLink
  links: MenuLink[]
}): MenuGroup {
  return { kind: 'topic', section: FLEET_SECTION, ...t }
}

/**
 * The family, in the order it is meant to be read.
 *
 * A constant rather than a builder: it takes no arguments, and a stable identity
 * is what keeps {@link useSiteMenu}'s `entries` memo from re-deriving every row
 * on every render.
 */
export const FLEET_MENU_GROUPS: MenuGroup[] = [
  leaf({ site: 'bitbag', description: "The hub's AI persona" }),
  topic({
    label: 'Hub',
    description: 'The center of it all',
    link: { site: 'hub' },
    links: [
      { site: 'news' },
      { site: 'status' },
      // Hub ROUTES, not sites: `/contact` and `/details` exist on the hub and are
      // resolved through it from every other site (see useSiteMenu's routeHref).
      { route: '/contact', label: 'Contact', description: 'Get in touch' },
      { site: 'community' },
      // hub-help (help.adh.com), not the delisted 'help' landing — the family's Help
      // destination since its promotion. Its key is the site id, so it stays distinct
      // from the Help-MODAL action row SiteMenu adds to the chrome above.
      { site: 'hub-help' },
      { site: 'support' },
      { route: '/details', label: 'Details', description: 'What the hub does' },
    ],
  }),
  leaf({ site: 'orgs' }),
  topic({
    label: 'Learn',
    description: 'Guides & courses',
    iconKey: 'learn',
    link: { site: 'help' },
    links: [
      { site: 'academy' },
      // hub-help again, NOT the 'help' landing this topic itself links to. Two reasons,
      // both from the registry: a family "Help" link points at hub-help by rule (see the
      // note above SiteDef 'help' in registry.ts), and `{ site: 'help' }` here would
      // resolve to the identical href as the Learn trigger above it — a row whose only
      // effect is to repeat its own parent. So Hub ▸ Help and Learn ▸ Help are one
      // destination reached from two groups, which is why they read the same.
      { site: 'hub-help' },
    ],
  }),
  topic({
    label: 'Plan',
    description: 'Decide what to build',
    iconKey: 'plan',
    links: [
      { site: 'projects' },
      { site: 'narratives', description: 'Your development story' },
      // The registry calls this site "Notebook"; the menu row is "Notes", so the
      // registry's own tagline ("Notes & notebooks") would echo the row's label.
      { site: 'notebook', label: 'Notes', description: 'Your notebook' },
      { site: 'research' },
    ],
  }),
  topic({
    label: 'Build',
    description: 'Make it',
    iconKey: 'build',
    links: [
      { site: 'devteam', label: 'Dev Team' },
      { site: 'codereviews', description: 'Review your code' },
      { site: 'cookbook' },
      { site: 'recipes' },
      { site: 'toolkit' },
      { site: 'tools' },
    ],
  }),
  topic({
    label: 'Personas',
    description: 'Your agentic personas',
    link: { site: 'personas' },
    links: [
      { site: 'personabuilder' },
      { site: 'personaregistry' },
      { site: 'knowledgebases', label: 'Knowledge' },
      { site: 'teambuilder' },
      { site: 'teamregistry' },
      { site: 'myagenticteams', label: 'My Agentic Teams', description: 'Your own agentic teams' },
    ],
  }),
  topic({
    label: 'Products',
    description: 'Your product platform',
    link: { site: 'products' },
    links: [
      { site: 'storage', label: 'Storage Buckets' },
      { site: 'ecosystems' },
      { site: 'authentication' },
      { site: 'customers' },
      { site: 'billing' },
      { site: 'notifications' },
      { site: 'sites' },
      { site: 'communities' },
      { site: 'dashboards' },
      { site: 'devices' },
      { site: 'domains' },
      { site: 'education' },
      { site: 'integrations' },
      { site: 'registries' },
      { site: 'gamification' },
      { site: 'games' },
    ],
  }),
  topic({
    label: 'Hire',
    description: 'Get expert help',
    link: { site: 'consulting' },
    links: [
      { site: 'consultants' },
      // The family has no consultant-registry site, so this row is an absolute href —
      // the last one in the tree. See MenuLink's `href` variant for what it costs.
      {
        href: 'https://agenticdeveloperregistry.com',
        label: 'Registry',
        description: 'The consultant registry',
        iconKey: 'registry',
      },
    ],
  }),
]
