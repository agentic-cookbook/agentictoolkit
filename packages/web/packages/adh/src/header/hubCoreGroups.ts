import { type MenuGroup, type MenuLink } from './SiteMenu'

// ─────────────────────────────────────────────────────────────────────────────
// The shared "Hub" core of the site menu — the Hub row and its inline sub-items,
// used identically by BOTH the marketing (logged-out) and workspace (logged-in)
// menus. Only the auth-conditional TOP section (built by SiteMenu) differs; this
// core is one source of truth so the two menus can't drift apart.
//
// Layout: "Hub" is a link to the hub apex AND the parent of its inline sub-items —
// the ecosystem's sites + tools, each an always-visible indented row (kind
// 'inline'). The former "Reference" (docs/api/mcp) flyout is intentionally gone.
// The in-hub DESTINATION rows (News + the workspace-area routes) are signed-in
// only, so they're appended only when `authenticated`.
//
// Everything sits in ONE section (1) so the whole Hub block reads as a single
// group; the top section is section 0, putting one divider between them.

const HUB_SECTION = 1

/** An always-visible indented sub-item under Hub. `blurb` surfaces the row's
 *  description (explicit here, else the site's own) as the trailing tagline, so
 *  every row reads as `[icon] [label] [description]`. */
const inline = (link: MenuLink): MenuGroup => ({
  kind: 'inline',
  section: HUB_SECTION,
  blurb: true,
  link,
})

/** Hub's inline sub-items that show in every state (ecosystem sites + tools). */
const ALWAYS_SUBITEMS: MenuGroup[] = [
  inline({ site: 'bitbag', description: "The hub's AI Persona, here to help!" }),
  inline({ site: 'community', description: "The hub's forums & discussions" }),
  inline({ site: 'personaregistry' }),
  inline({ site: 'toolkit' }),
  inline({ site: 'cookbook' }),
  inline({ site: 'devteam', description: 'Your LLM agentic dev team' }),
  inline({ site: 'myagenticteams', description: 'Build your own agentic teams' }),
  inline({ site: 'narratives', description: 'Your project development story' }),
  // hub-help (help.adh.com), not the delisted 'help' landing — the family's Help
  // destination since its promotion; also keeps this row's key distinct from the
  // Help-modal action row SiteMenu adds (both keyed by site id / 'help' before).
  inline({ site: 'hub-help', description: 'Top level help site' }),
]

/** In-hub destinations — signed-in only (News + the workspace-area routes). */
const AUTHED_SUBITEMS: MenuGroup[] = [
  inline({ site: 'news', description: 'The latest Hub news!' }),
  // Products replaced the old /ecosystems rail feature (each product IS an ecosystem).
  inline({ route: '/products', label: 'Products', description: 'Build and manage your products' }),
  inline({ route: '/personas', label: 'Personas', description: 'Register and configure your personas' }),
  inline({ route: '/organizations', label: 'Organizations', description: 'Manage your organizations' }),
  inline({ route: '/research', label: 'Research', description: 'Write, organize, and publish your research' }),
]

/**
 * The Hub core groups: the Hub row + its inline sub-items. The in-hub destination
 * rows are included only when `authenticated` (they need a signed-in session).
 */
export function hubCoreGroups(authenticated: boolean): MenuGroup[] {
  return [
    { kind: 'leaf', section: HUB_SECTION, blurb: true, link: { site: 'hub', description: 'The center of the Agentic Developer ecosystem' } },
    ...ALWAYS_SUBITEMS,
    ...(authenticated ? AUTHED_SUBITEMS : []),
  ]
}
