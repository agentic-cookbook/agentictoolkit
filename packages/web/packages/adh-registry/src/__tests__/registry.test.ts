import { describe, it, expect } from 'vitest'
import { readdirSync, statSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { SITES, LISTED_SITES, FOOTER_SITES, MAIN_SITE_IDS, MARKETING_SITE_IDS, SITE_CATEGORIES, groupSitesByCategory, getSite, detectEnv, buildSiteHref, ssoReturnOrigins, HUB_FEATURE_SEGMENT, isHubWorkspacePath, hubWorkspaceSlug, hubSwitchHref } from '../sites/registry'

const hub = getSite('hub')!
const cookbook = getSite('cookbook')!
const admin = getSite('admin')!
const hubHelp = getSite('hub-help')! // help.adh.com; hasHome: false
const mcp = getSite('mcp')! // a still-staging-only site (hasTesting: false)

describe('detectEnv', () => {
  it('classifies production hosts', () => {
    expect(detectEnv('agenticdeveloperhub.com')).toBe('production')
    expect(detectEnv('admin.agenticdeveloperhub.com')).toBe('production')
  })
  it('classifies testing / staging by leading label', () => {
    expect(detectEnv('testing.agenticdeveloperhub.com')).toBe('testing')
    expect(detectEnv('staging.admin.agenticdeveloperhub.com')).toBe('staging')
  })
  it('classifies local hosts (localhost, 127.*, *.local, *.localhost, ports)', () => {
    expect(detectEnv('localhost')).toBe('local')
    expect(detectEnv('localhost:3000')).toBe('local')
    expect(detectEnv('127.0.0.1')).toBe('local')
    expect(detectEnv('projects.dev.local')).toBe('local')
    // *.localhost subdomains — used by single-site `next dev` for cross-site local routing
    expect(detectEnv('admin.localhost')).toBe('local')
    expect(detectEnv('cookbook.localhost:5171')).toBe('local')
    expect(detectEnv('hub.localhost:5171')).toBe('local')
  })
})

describe('buildSiteHref', () => {
  it('carries /home to the target in the same env', () => {
    expect(buildSiteHref(hub, 'agenticdeveloperhub.com', '/home')).toBe(
      'https://agenticdeveloperhub.com/home',
    )
  })
  it('falls back testing → staging when the target lacks a testing env', () => {
    // mcp has no testing env (hasTesting: false), so from testing.* it resolves to staging.*
    expect(buildSiteHref(mcp, 'testing.agenticdeveloperhub.com', '/')).toBe(
      'https://staging.mcp.agenticdeveloperhub.com/',
    )
  })
  it('keeps the staging env when the target supports it', () => {
    expect(buildSiteHref(admin, 'staging.agenticdeveloperhub.com', '/')).toBe(
      'https://staging.admin.agenticdeveloperhub.com/',
    )
  })
  it('carries deep /home routes with the up-walk marker', () => {
    expect(buildSiteHref(hub, 'agenticdeveloperhub.com', '/home/foo')).toBe(
      'https://agenticdeveloperhub.com/home/foo#site-switch',
    )
  })
  it('sends /home to root for sites without a /home route', () => {
    expect(buildSiteHref(hubHelp, 'agenticdeveloperhub.com', '/home')).toBe(
      'https://help.agenticdeveloperhub.com/',
    )
  })
  it('carries /home to marketing feature sites — the fleet is hasHome now', () => {
    // Every marketing satellite exposes the gated /home feature surface
    // (docs/platform/feature-sites-redesign.md), so the switcher carries /home across.
    const academy = getSite('academy')!
    expect(buildSiteHref(academy, 'agenticdeveloperhub.com', '/home')).toBe(
      'https://agenticdeveloperacademy.com/home',
    )
  })
  it('sends site-specific deep routes to the target landing', () => {
    expect(buildSiteHref(hub, 'agenticdevelopercookbook.com', '/recipes/x')).toBe(
      'https://agenticdeveloperhub.com/',
    )
  })
  it('resolves to a local origin from local dev (bare localhost, no port)', () => {
    expect(buildSiteHref(cookbook, 'localhost', '/home')).toBe('http://cookbook.localhost/home')
  })
})

describe('local cross-site origins', () => {
  it('routes hub to the bare localhost apex on the current port', () => {
    const hub = getSite('hub')!
    expect(buildSiteHref(hub, 'admin.localhost:5171', '/')).toBe('http://localhost:5171/')
  })

  it('routes a non-hub site to <id>.localhost on the current port', () => {
    expect(buildSiteHref(cookbook, 'localhost:5171', '/')).toBe('http://cookbook.localhost:5171/')
  })

  // dev.local suite scheme: apex is `<suite>.dev.local`, others `<id>.<suite>.dev.local`.
  it('routes hub to the bare suite apex from a dev.local child host', () => {
    expect(buildSiteHref(hub, 'admin.hub.dev.local', '/')).toBe('https://hub.dev.local/')
  })

  it('routes a non-hub site to <id>.<suite>.dev.local from the dev.local apex', () => {
    expect(buildSiteHref(cookbook, 'hub.dev.local', '/')).toBe('https://cookbook.hub.dev.local/')
  })

  it('preserves a per-worktree suite suffix across the dev.local switch', () => {
    // from a child on the `hub-mybranch` suite, hub → the suite apex, cookbook → its child
    expect(buildSiteHref(hub, 'admin.hub-mybranch.dev.local', '/')).toBe('https://hub-mybranch.dev.local/')
    expect(buildSiteHref(cookbook, 'hub-mybranch.dev.local', '/home')).toBe('https://cookbook.hub-mybranch.dev.local/home')
  })

  it('still uses https prod hosts when not local', () => {
    expect(buildSiteHref(cookbook, 'agenticdeveloperhub.com', '/')).toBe(
      'https://agenticdevelopercookbook.com/',
    )
  })

  it('routes the persona registry to its <id>.<suite>.dev.local local subdomain', () => {
    const registry = getSite('personaregistry')!
    // The site id matches the suite's leaf dir (`personaregistry`), so the local
    // cross-site link resolves to where the suite actually serves the app.
    expect(buildSiteHref(registry, 'hub-personas-move.dev.local', '/home')).toBe(
      'https://personaregistry.hub-personas-move.dev.local/home',
    )
    // Local-only subdomain; testing/prod derive from prodHost (agenticpersonaregistry.com).
    expect(buildSiteHref(registry, 'testing.agenticdeveloperhub.com', '/home')).toBe(
      'https://testing.agenticpersonaregistry.com/home',
    )
  })
})

describe('ssoReturnOrigins (central adh SSO client allowlist, per env)', () => {
  it('production = every non-external site as a bare-host origin (no env prefix)', () => {
    const origins = ssoReturnOrigins('production')
    expect(origins.length).toBe(SITES.filter((s) => !s.external).length)
    // one origin per site, scheme + bare prod host, no path
    expect(origins).toContain('https://agenticdeveloperhub.com')
    expect(origins).toContain('https://agenticdevelopercookbook.com')
    expect(origins).toContain('https://bitbag.ai')
    expect(origins).toContain('https://learntruefacts.ai')
    expect(origins.every((o) => /^https:\/\/[^/]+$/.test(o))).toBe(true)
    expect(origins.some((o) => o.includes('staging.') || o.includes('testing.'))).toBe(false)
  })

  it('never allows an external link-out origin, in any env', () => {
    // FishLamp Design is a site we own but not an ADH app: it has no
    // /auth/callback and never begins an ADH login, so it must never be a legal
    // OAuth `return` target. Guarding all three envs keeps the redirect surface
    // tied to apps that can actually complete a login.
    const externals = SITES.filter((s) => s.external)
    expect(externals.map((s) => s.id).sort()).toEqual(['fishlamp', 'fishlampdesign'])
    for (const env of ['production', 'staging', 'testing'] as const) {
      const origins = ssoReturnOrigins(env)
      for (const s of externals) {
        expect(origins.some((o) => o.includes(s.prodHost)), `${s.id} in ${env}`).toBe(false)
      }
    }
  })

  it('testing = only sites with a testing deploy, prefixed testing.', () => {
    const origins = ssoReturnOrigins('testing')
    const testingSites = SITES.filter((s) => s.hasTesting && !s.external)
    expect(origins.length).toBe(testingSites.length)
    expect(new Set(origins)).toEqual(
      new Set(testingSites.map((s) => `https://testing.${s.prodHost}`)),
    )
    // a site without a testing env (mcp) never reaches the testing backend
    expect(origins).not.toContain('https://testing.mcp.agenticdeveloperhub.com')
    expect(origins.every((o) => o.startsWith('https://testing.'))).toBe(true)
  })

  it('staging = every staging-deploy site, prefixed staging.', () => {
    const origins = ssoReturnOrigins('staging')
    const stagingSites = SITES.filter((s) => s.hasStaging && !s.external)
    expect(origins.length).toBe(stagingSites.length)
    expect(origins).toContain('https://staging.agenticdevelopercookbook.com')
    expect(origins).toContain('https://staging.agenticdeveloperhub.com')
    expect(origins.every((o) => o.startsWith('https://staging.'))).toBe(true)
  })
})

describe('SITES registry', () => {
  it('has unique ids and excludes the backend', () => {
    const ids = SITES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).not.toContain('backend')
  })
  it('every site has a label and a production host', () => {
    for (const s of SITES) {
      expect(s.label.length).toBeGreaterThan(0)
      expect(s.prodHost).toMatch(/\./)
    }
  })
})

describe('LISTED_SITES (switcher list)', () => {
  it('pins the full switcher order (the authoritative sequence)', () => {
    expect(LISTED_SITES.map((s) => s.id)).toEqual([
      'bitbag',
      'hub',
      'cookbook',
      'projects',
      'narratives',
      'personaregistry',
      'devteam',
      'toolkit',
      'myagenticteams',
      'mcp',
      // <gen:order> managed by scaffold-sites.py — do not edit by hand
      'community',
      'support',
      // hub-help (help.adh.com) is the family's listed Help site; the old landing
      // (id 'help') is delisted. Hand-managed — not an adh-new-sites.json site.
      'hub-help',
      'news',
      'academy',
      'dashboards',
      'personas',
      'communities',
      'ecosystems',
      'registries',
      'storage',
      'customers',
      'products',
      'billing',
      'domains',
      'authentication',
      'sites',
      'devices',
      'notifications',
      'knowledgebases',
      'tools',
      'teamregistry',
      'teambuilder',
      'codereviews',
      'personabuilder',
      'research',
      'consultants',
      // </gen:order>
      'fishlamp',
      'fishlampdesign',
      'admin',
      'status',
      'builds',
    ])
  })
  it('lists admin + status but still hides learntruefacts', () => {
    const ids = LISTED_SITES.map((s) => s.id)
    expect(ids).toContain('admin')
    expect(ids).toContain('status')
    expect(ids).not.toContain('learntruefacts')
  })
  it('includes the new mcp entry', () => {
    expect(LISTED_SITES.map((s) => s.id)).toContain('mcp')
    expect(getSite('mcp')?.prodHost).toBe('mcp.agenticdeveloperhub.com')
  })
  it('puts bitbag first, set apart as its own top section', () => {
    const first = LISTED_SITES[0]!
    expect(first.id).toBe('bitbag')
    expect(first.prodHost).toBe('bitbag.ai')
    // the family entry after bitbag opens a new section with a divider
    expect(LISTED_SITES[1]!.dividerBefore).toBe(true)
  })
  it('keeps the folded sites registered but out of the switcher', () => {
    // education → academy, recipes → cookbook, consulting → the studio brand
    // (portfolio pruning): still registered (headers resolve, /details serve, SSO
    // origins unchanged), but delisted from the switcher + footer. Contrast the
    // retired Agentic Developer Studio, which was DELETED outright rather than
    // folded — see the dead-domain test below.
    const ids = LISTED_SITES.map((s) => s.id)
    for (const folded of ['education', 'recipes', 'consulting'] as const) {
      expect(getSite(folded), `${folded} stays registered`).toBeDefined()
      expect(getSite(folded)!.listed).toBe(false)
      expect(ids).not.toContain(folded)
    }
  })
  it('has no trace of the retired studio site, on either dead domain', () => {
    // Agentic Developer Studio was not folded like the sites above — the app was
    // deleted and the brand replaced by FishLamp Design, so nothing in the family
    // should still know either host. Both domains are dead: nothing redirects
    // them at fishlamp.com. Pinned because the registry is what drives the
    // generated route map, the switcher, the footer interlinks AND the OAuth
    // return-origin allowlist — a leftover entry would quietly re-add a dead
    // origin to all four.
    for (const dead of ['agenticdeveloper.studio', 'agenticdevelopmentstudio.com'] as const) {
      expect(SITES.map((s) => s.prodHost), dead).not.toContain(dead)
      for (const env of ['production', 'staging', 'testing'] as const) {
        expect(ssoReturnOrigins(env).join('|'), `${dead} in ${env}`).not.toContain(dead)
      }
    }
  })
  it('resolves consulting per-env: prod/staging/testing all direct, no env leak', () => {
    const consulting = getSite('consulting')!
    expect(buildSiteHref(consulting, 'agenticdeveloperhub.com', '/')).toBe(
      'https://agenticdeveloperconsulting.com/',
    )
    expect(buildSiteHref(consulting, 'staging.agenticdeveloperhub.com', '/')).toBe(
      'https://staging.agenticdeveloperconsulting.com/',
    )
    // consulting now has a testing env → testing resolves directly (no staging fallback)
    expect(buildSiteHref(consulting, 'testing.agenticdeveloperhub.com', '/')).toBe(
      'https://testing.agenticdeveloperconsulting.com/',
    )
  })
  it('features FishLamp Design (name-only, divider) ahead of the admin + status section', () => {
    const ids = LISTED_SITES.map((s) => s.id)
    const fishlamp = ids.indexOf('fishlamp')
    const admin = ids.indexOf('admin')
    const status = ids.indexOf('status')
    // the studio brand comes before the trailing console section
    expect(fishlamp).toBeLessThan(admin)
    expect(admin).toBeLessThan(status)
    const fishlampDef = getSite('fishlamp')!
    expect(fishlampDef.dividerBefore).toBe(true)
    // `featured` marks it as the brand the family sits under. Nothing renders it
    // yet (see SiteDef.featured), so this pins the marker's location, not any
    // visual behavior.
    expect(fishlampDef.featured).toBe(true)
    // FishLamp carries a description — the overview popover shows one per row.
    expect(fishlampDef.description).toBeTruthy()
    expect(getSite('admin')?.dividerBefore).toBe(true)
  })
  it('resolves the external FishLamp domains directly in every env (no env prefix)', () => {
    // fishlamp.com has no staging/testing tier, so hostForEnv falls all the way
    // back to the production host — a testing build must still link the real site,
    // never an invented testing.fishlamp.com.
    for (const id of ['fishlamp', 'fishlampdesign'] as const) {
      const site = getSite(id)!
      expect(site.external).toBe(true)
      for (const host of [
        'agenticdeveloperhub.com',
        'staging.agenticdeveloperhub.com',
        'testing.agenticdeveloperhub.com',
      ]) {
        expect(buildSiteHref(site, host, '/')).toBe(`https://${site.prodHost}/`)
      }
    }
  })
  it('ends with the admin + status + builds console section', () => {
    const ids = LISTED_SITES.map((s) => s.id)
    expect(ids[ids.length - 1]).toBe('builds')
    expect(ids[ids.length - 2]).toBe('status')
    expect(ids[ids.length - 3]).toBe('admin')
  })
})

describe('MAIN_SITE_IDS / MARKETING_SITE_IDS (dev site-menu families)', () => {
  // The Next app folders under frontend/src/ are the source of truth for the two
  // families; these arrays must mirror them so a newly-scaffolded site can't
  // silently drop out of the dev site menu. This test file lives at
  // frontend/src/app/registry/src/__tests__, so frontend/src/ is four levels up —
  // the same depth it was at frontend/src/shared/adh/src/__tests__ before the
  // @adh-shared retirement moved this package, which is why the `../../../..`
  // below needed no change.
  const frontendSrcDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..')
  // Build/tooling directories that can sit beside the real site apps — excluded so
  // the guard tracks site folders, not filesystem noise (a stray `.next` or
  // `node_modules` must not false-fail a test about the site registry).
  const NON_SITE_DIRS = new Set(['node_modules', 'dist', 'build', '.next', '.turbo'])
  const siteFolders = (family: 'main' | 'marketing'): string[] =>
    readdirSync(resolve(frontendSrcDir, family))
      .filter((name) => !name.startsWith('.') && !NON_SITE_DIRS.has(name))
      .filter((name) => statSync(resolve(frontendSrcDir, family, name)).isDirectory())
      // A real site folder is a Next app (has app/). Excludes data-only dirs like
      // main/api (the committed openapi.json the api-types codegen + hub-help read),
      // which gen-site-routes.py skips for the same reason.
      .filter((name) => existsSync(resolve(frontendSrcDir, family, name, 'app')))
      .sort()

  it('MAIN_SITE_IDS mirrors the frontend/src/main/ folders exactly', () => {
    expect([...MAIN_SITE_IDS].sort()).toEqual(siteFolders('main'))
  })
  it('MARKETING_SITE_IDS mirrors the frontend/src/marketing/ folders exactly', () => {
    expect([...MARKETING_SITE_IDS].sort()).toEqual(siteFolders('marketing'))
  })
  it('every family id is a real registry site, with no dupes or cross-family overlap', () => {
    const all = [...MAIN_SITE_IDS, ...MARKETING_SITE_IDS]
    expect(new Set(all).size).toBe(all.length) // no dupes within or across the two lists
    for (const id of all) expect(getSite(id), `${id} must be a registry site`).toBeTruthy()
  })
})

describe('SITE_CATEGORIES (menu + overview grouping)', () => {
  it('covers every listed site exactly once (no orphans, no dupes)', () => {
    const inCats = SITE_CATEGORIES.flatMap((c) => c.ids)
    expect(new Set(inCats).size).toBe(inCats.length) // no dupes
    const listed = new Set(LISTED_SITES.map((s) => s.id))
    // every categorized id is a real listed site
    for (const id of inCats) expect(listed.has(id)).toBe(true)
    // every listed site is categorized (groupSitesByCategory adds no "More")
    const grouped = groupSitesByCategory(LISTED_SITES)
    expect(grouped.some((g) => g.label === 'More')).toBe(false)
    expect(grouped.flatMap((g) => g.sites).length).toBe(LISTED_SITES.length)
  })
  it('groups in the declared order, Operations last', () => {
    const labels = groupSitesByCategory(LISTED_SITES).map((g) => g.label)
    expect(labels).toEqual(['Develop', 'Build', 'Sell', 'Learn & community', 'Studio & consulting', 'Operations'])
  })
})

describe('FOOTER_SITES (SEO interlinks)', () => {
  it('pins the full footer order (switcher order minus non-crawlable mcp)', () => {
    expect(FOOTER_SITES.map((s) => s.id)).toEqual([
      'bitbag',
      'hub',
      'cookbook',
      'projects',
      // narratives' prod domain is live, so it is a footer interlink now
      'narratives',
      'personaregistry',
      'devteam',
      'toolkit',
      'myagenticteams',
      // <gen:order> managed by scaffold-sites.py — do not edit by hand
      'community',
      'support',
      'hub-help',
      'news',
      'academy',
      'dashboards',
      'personas',
      'communities',
      'ecosystems',
      'registries',
      'storage',
      'customers',
      'products',
      'billing',
      'domains',
      'authentication',
      'sites',
      'devices',
      'notifications',
      'knowledgebases',
      'tools',
      'teamregistry',
      'teambuilder',
      'codereviews',
      'personabuilder',
      'research',
      'consultants',
      // </gen:order>
      'fishlamp',
      'fishlampdesign',
      'admin',
      'status',
      'builds',
    ])
  })
  it('excludes the non-HTML mcp endpoint and the delisted sites, but keeps the content sites', () => {
    const ids = FOOTER_SITES.map((s) => s.id)
    expect(ids).not.toContain('mcp')
    expect(ids).toContain('hub')
    expect(ids).toContain('cookbook')
    expect(ids).toContain('narratives')
    // both FishLamp Design domains are interlinked from every footer
    expect(ids).toContain('fishlamp')
    expect(ids).toContain('fishlampdesign')
  })
  it('leads with bitbag and ends with FishLamp, then admin, status, builds', () => {
    const ids = FOOTER_SITES.map((s) => s.id)
    expect(ids[0]).toBe('bitbag')
    expect(ids.indexOf('fishlamp')).toBeLessThan(ids.indexOf('admin'))
    expect(ids.indexOf('admin')).toBeLessThan(ids.indexOf('status'))
    expect(ids.indexOf('status')).toBeLessThan(ids.indexOf('builds'))
    expect(ids[ids.length - 1]).toBe('builds')
  })
  it('every footer site has a non-empty description for the overview popover', () => {
    for (const s of FOOTER_SITES) {
      expect(s.description, `${s.id} needs a description`).toBeTruthy()
    }
  })
  it('sectionLabels partition the overview into contiguous groups, first entry labelled', () => {
    // The first footer entry must open a group (no unlabelled lead), and each
    // labelled entry starts a new group — so the overview is fully grouped.
    expect(FOOTER_SITES[0]!.sectionLabel).toBeTruthy()
    const labels = FOOTER_SITES.filter((s) => s.sectionLabel).map((s) => s.sectionLabel)
    expect(labels).toEqual([
      'Core platform',
      'Developer platform',
      'Studio & consulting',
      'Operations',
    ])
  })
})

describe('HUB_FEATURE_SEGMENT (in-hub workspace switching)', () => {
  it('maps only real registry sites, to bare feature segments (one site per segment, except the documented products alias)', () => {
    const ids = new Set(SITES.map((s) => s.id))
    for (const id of Object.keys(HUB_FEATURE_SEGMENT)) {
      expect(ids.has(id as (typeof SITES)[number]['id']), `${id} must be a registry site`).toBe(true)
    }
    // Segments are unique per site — EXCEPT 'products': ecosystems are managed as
    // PRODUCTS in the hub, so BOTH the ecosystems and products sites deliberately
    // switch into /<slug>/products (see the map's comment). Any other duplicate
    // segment is a drift bug.
    const bySegment = new Map<string, string[]>()
    for (const [id, seg] of Object.entries(HUB_FEATURE_SEGMENT)) {
      bySegment.set(seg!, [...(bySegment.get(seg!) ?? []), id])
    }
    for (const [seg, sites] of bySegment) {
      if (seg === 'products') {
        expect(sites.sort()).toEqual(['ecosystems', 'products'])
      } else {
        expect(sites, `segment '${seg}' must map exactly one site`).toHaveLength(1)
      }
      // a bare single segment, e.g. 'storage' — no leading slash, never nested
      expect(seg).toMatch(/^[a-z-]+$/)
    }
  })
  it('does not map sites whose workspace is not a hub feature route', () => {
    for (const id of ['hub', 'cookbook', 'admin', 'status', 'bitbag'] as const) {
      expect(HUB_FEATURE_SEGMENT[id]).toBeUndefined()
    }
  })
  it('resolves hubSwitchHref to a slug-scoped workspace path', () => {
    expect(hubSwitchHref('acme', getSite('knowledgebases')!)).toBe('/acme/knowledgebases')
    expect(hubSwitchHref('acme', getSite('dashboards')!)).toBe('/acme/dashboards')
    // the personas registry site switches into the persona-data CRUD at /<slug>/all-data
    expect(hubSwitchHref('acme', getSite('personas')!)).toBe('/acme/all-data')
    // the /home IA restructure: storage is a top-level workspace feature again, and
    // both the ecosystems and products sites switch into the Products view.
    expect(hubSwitchHref('acme', getSite('storage')!)).toBe('/acme/storage')
    expect(hubSwitchHref('acme', getSite('ecosystems')!)).toBe('/acme/products')
    // a site with no hub workspace → undefined (switcher falls back to cross-site).
    expect(hubSwitchHref('acme', getSite('cookbook')!)).toBeUndefined()
    expect(hubSwitchHref('acme', getSite('customers')!)).toBeUndefined()
  })
})

describe('isHubWorkspacePath (/<slug>/<home|feature>)', () => {
  it('matches /<slug>/home and deeper home routes', () => {
    expect(isHubWorkspacePath('/acme/home')).toBe(true)
    expect(isHubWorkspacePath('/acme/home/persona-services')).toBe(true)
  })
  it('matches /<slug>/<feature> routes and their subpaths', () => {
    expect(isHubWorkspacePath('/acme/knowledgebases')).toBe(true)
    expect(isHubWorkspacePath('/acme/knowledgebases/facts')).toBe(true)
    expect(isHubWorkspacePath('/acme/billing')).toBe(true)
    // the persona-data CRUD segment
    expect(isHubWorkspacePath('/acme/all-data')).toBe(true)
  })
  it('matches the site-less workspace features (direct-URL only)', () => {
    expect(isHubWorkspacePath('/acme/teams')).toBe(true)
    expect(isHubWorkspacePath('/acme/teams/some-id/members')).toBe(true)
    expect(isHubWorkspacePath('/acme/projects')).toBe(true)
  })
  it('matches the persona-editor route (a workspace route, distinct from the all-data CRUD)', () => {
    // /<slug>/personas is a first-class workspace route; the personas registry site
    // still switches into /<slug>/all-data (see hubSwitchHref). Both chrome surfaces
    // (the switcher/drawer and the app header's FEATURE_META) must agree it's one.
    expect(isHubWorkspacePath('/acme/personas')).toBe(true)
    expect(hubWorkspaceSlug('/acme/personas')).toBe('acme')
  })
  it('matches the slug-less workspace shell routes (/home and /home/*)', () => {
    // The signed-in workspace shell lives at the slug-less /home, /home/settings,
    // /home/persona-services; the switcher keeps the in-hub menu there (useSiteMenu
    // falls back to the personal slug for the feature links). segs[0] === 'home'.
    expect(isHubWorkspacePath('/home')).toBe(true)
    expect(isHubWorkspacePath('/home/settings')).toBe(true)
    expect(isHubWorkspacePath('/home/persona-services')).toBe(true)
  })
  it('rejects marketing, root, and bare top-level paths', () => {
    expect(isHubWorkspacePath('/')).toBe(false)
    expect(isHubWorkspacePath('/details')).toBe(false)
    expect(isHubWorkspacePath('/about')).toBe(false)
    // a bare top-level feature segment is no longer a workspace path (it now lives
    // under a slug) — these are marketing / redirect routes
    expect(isHubWorkspacePath('/storage')).toBe(false)
    // the second segment must be a known workspace feature
    expect(isHubWorkspacePath('/acme/about')).toBe(false)
    expect(isHubWorkspacePath('/acme/store')).toBe(false)
  })
})

describe('hubWorkspaceSlug', () => {
  it('extracts the active slug from a workspace path', () => {
    expect(hubWorkspaceSlug('/acme/home')).toBe('acme')
    expect(hubWorkspaceSlug('/acme/products')).toBe('acme')
    expect(hubWorkspaceSlug('/acme/knowledgebases/facts')).toBe('acme')
    expect(hubWorkspaceSlug('/acme/all-data')).toBe('acme')
  })
  it('returns null off a workspace path', () => {
    expect(hubWorkspaceSlug('/')).toBeNull()
    expect(hubWorkspaceSlug('/details')).toBeNull()
    expect(hubWorkspaceSlug('/acme/about')).toBeNull()
    expect(hubWorkspaceSlug('/storage')).toBeNull()
  })
})
