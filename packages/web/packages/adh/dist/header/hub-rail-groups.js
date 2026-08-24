// src/header/hub-rail-groups.ts
import {
  hubFeatureSegment,
  SITE_FOR_HUB_SEGMENT
} from "@agentic-toolkit/adh-registry";

// src/header/fleetMenuGroups.ts
import { ADMIN_SITE_IDS } from "@agentic-toolkit/adh-registry";
var FLEET_SECTION = 1;
var ADMIN_SECTION = FLEET_SECTION + 1;
function leaf(link) {
  return { kind: "leaf", section: FLEET_SECTION, blurb: true, link };
}
function topic(t) {
  return { kind: "topic", section: FLEET_SECTION, ...t };
}
var FLEET_MENU_GROUPS = [
  leaf({ site: "bitbag", description: "The hub's AI persona" }),
  leaf({ site: "messages", description: "Your messages, everywhere" }),
  topic({
    label: "Hub",
    description: "The center of it all",
    link: { site: "hub" },
    links: [
      { site: "news" },
      { site: "status" },
      // Hub ROUTES, not sites: `/contact` and `/details` exist on the hub and are
      // resolved through it from every other site (see useSiteMenu's routeHref).
      { route: "/contact", label: "Contact", description: "Get in touch" },
      { site: "community" },
      // hub-help (help.adh.com), not the delisted 'help' landing — the family's Help
      // destination since its promotion. Its key is the site id, so it stays distinct
      // from the Help-MODAL action row SiteMenu adds to the chrome above.
      { site: "hub-help" },
      { site: "support" },
      { site: "store" },
      { route: "/details", label: "Details", description: "What the hub does" }
    ]
  }),
  leaf({ site: "orgs" }),
  topic({
    label: "Learn",
    description: "Guides & courses",
    iconKey: "learn",
    link: { site: "help" },
    links: [
      { site: "academy" },
      // hub-help again, NOT the 'help' landing this topic itself links to. Two reasons,
      // both from the registry: a family "Help" link points at hub-help by rule (see the
      // note above SiteDef 'help' in registry.ts), and `{ site: 'help' }` here would
      // resolve to the identical href as the Learn trigger above it — a row whose only
      // effect is to repeat its own parent. So Hub ▸ Help and Learn ▸ Help are one
      // destination reached from two groups, which is why they read the same.
      { site: "hub-help" }
    ]
  }),
  topic({
    label: "Plan",
    description: "Decide what to build",
    iconKey: "plan",
    links: [
      { site: "projects" },
      { site: "narratives", description: "Your development story" },
      // The registry calls this site "Notebook"; the menu row is "Notes", so the
      // registry's own tagline ("Notes & notebooks") would echo the row's label.
      { site: "notebook", label: "Notes", description: "Your notebook" },
      { site: "research" },
      { site: "docs" }
    ]
  }),
  topic({
    label: "Build",
    description: "Make it",
    iconKey: "build",
    links: [
      { site: "devteam", label: "Dev Team" },
      { site: "codereviews", description: "Review your code" },
      { site: "cookbook" },
      { site: "recipes" },
      { site: "toolkit" },
      { site: "tools" },
      { site: "testing" }
    ]
  }),
  topic({
    label: "Personas",
    description: "Your agentic personas",
    link: { site: "personas" },
    links: [
      { site: "personabuilder" },
      { site: "personaregistry" },
      { site: "knowledgebases", label: "Knowledge" },
      { site: "teambuilder" },
      { site: "teamregistry" },
      { site: "myagenticteams", label: "My Agentic Teams", description: "Your own agentic teams" }
    ]
  }),
  topic({
    label: "Products",
    description: "Your product platform",
    link: { site: "products" },
    links: [
      { site: "storage", label: "Storage Buckets" },
      { site: "ecosystems" },
      { site: "authentication" },
      { site: "customers" },
      { site: "billing" },
      { site: "messaging", description: "Email & SMS for your products" },
      { site: "notifications" },
      { site: "sites" },
      { site: "communities" },
      { site: "dashboards" },
      { site: "devices" },
      { site: "domains" },
      { site: "education" },
      { site: "integrations" },
      { site: "registries" },
      { site: "gamification" },
      { site: "games" },
      { site: "stores" }
    ]
  }),
  topic({
    label: "Hire",
    description: "Get expert help",
    link: { site: "consulting" },
    links: [
      { site: "consultants" },
      // Was an absolute href while the family had no registry site; it is a real
      // registry entry now, so the row is env-aware and SSO-wrapped like the rest.
      { site: "registry" },
      // The studio the family sits under. An absolute href, not a `{ site }`: the
      // Agentic Development Studio has no app in this repo and deliberately no
      // registry entry (`registry.test.ts` pins that agenticdevelopmentstudio.com is
      // NOT a registry host — a registry entry would silently re-add the origin to
      // the OAuth return allowlist and to the generated route map). See MenuLink's
      // `href` variant for the three things this row therefore does without.
      {
        href: "https://agenticdevelopmentstudio.com",
        label: "Agentic Development Studio",
        description: "The studio behind the Hub",
        iconKey: "consulting"
      }
    ]
  })
];
var ADMIN_MENU_GROUPS = [
  {
    kind: "topic",
    section: ADMIN_SECTION,
    label: "Admin",
    description: "Operations consoles",
    iconKey: "admin",
    links: [
      ...ADMIN_SITE_IDS.map((site) => ({ site })),
      {
        href: "https://lewis.agenticdeveloperhub.com",
        label: "Fleet Monitor",
        description: "What every service is doing",
        iconKey: "monitor"
      }
    ]
  }
];

// src/header/hub-rail-groups.ts
var PROMOTED_GROUP_LABEL = "Hub";
var LEFTOVER_GROUP_LABEL = "More";
function siteOf(link) {
  return "site" in link ? link.site : void 0;
}
function segmentOf(link) {
  const site = siteOf(link);
  return site ? hubFeatureSegment(site) : void 0;
}
function railGroupId(label) {
  return `group:${label.toLowerCase()}`;
}
var HUB_PROMOTED_GROUP_ID = railGroupId(PROMOTED_GROUP_LABEL);
var HUB_RAIL_GROUPS = (() => {
  const groups = [];
  const byLabel = /* @__PURE__ */ new Map();
  const claimed = /* @__PURE__ */ new Set();
  const group = (label, seed) => {
    const existing = byLabel.get(label);
    if (existing) return existing;
    const made = { id: railGroupId(label), label, ...seed, segments: [] };
    byLabel.set(label, made);
    groups.push(made);
    return made;
  };
  const claim = (into, link) => {
    const segment = link && segmentOf(link);
    if (segment === void 0 || claimed.has(segment)) return;
    claimed.add(segment);
    into.segments.push(segment);
  };
  for (const entry of FLEET_MENU_GROUPS) {
    if (entry.kind === "topic") {
      const iconKey = entry.iconKey ?? (entry.link ? siteOf(entry.link) : void 0);
      const into = group(entry.label, { description: entry.description, iconKey });
      claim(into, entry.link);
      for (const link of entry.links) claim(into, link);
      continue;
    }
    claim(group(PROMOTED_GROUP_LABEL), entry.link);
  }
  const everySegment = Object.keys(SITE_FOR_HUB_SEGMENT);
  const leftover = everySegment.filter((s) => !claimed.has(s));
  if (leftover.length) group(LEFTOVER_GROUP_LABEL).segments.push(...leftover);
  return groups.filter((g) => g.segments.length > 0);
})();
var HUB_RAIL_GROUP_FOR_SEGMENT = (() => {
  const out = {};
  for (const group of HUB_RAIL_GROUPS) {
    for (const segment of group.segments) out[segment] = group.id;
  }
  return out;
})();
export {
  HUB_PROMOTED_GROUP_ID,
  HUB_RAIL_GROUPS,
  HUB_RAIL_GROUP_FOR_SEGMENT
};
//# sourceMappingURL=hub-rail-groups.js.map