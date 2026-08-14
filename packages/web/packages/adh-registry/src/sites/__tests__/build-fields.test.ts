import { describe, expect, it } from "vitest";
import { SITES, isSiteId, type SiteDef } from "../registry.js";

// `SITES` is a `SiteDef[]`, not a `Record<SiteId, SiteDef>` — the earlier probe that
// staged this test assumed a keyed record and did not confirm it, so the assertions
// below read the array by `.id` rather than through `Object.entries`/index access.
// The substance (which sites carry which flag, and what value) is unchanged from the
// brief; only the access mechanics differ from the record-shaped draft.

// The 9 sites that set `legacyHomePaths: true` today, MINUS cookbook, which keeps its
// hand-written config (Ruling T4-a) and therefore keeps setting the flag at its call site.
const LEGACY_HOME_PATH_SITES = [
  "dashboards", "ecosystems", "knowledgebases", "narratives",
  "projects", "personabuilder", "teamregistry", "research",
];

function findSite(id: string): SiteDef | undefined {
  return SITES.find((s) => s.id === id);
}

describe("site build fields", () => {
  it("marks exactly the eight registry-owned legacy-home-path sites", () => {
    const flagged = SITES.filter((s) => s.legacyHomePaths)
      .map((s) => s.id)
      .sort();
    expect(flagged).toEqual([...LEGACY_HOME_PATH_SITES].sort());
  });

  // cookbook and hub must NOT appear: they are the exempt pair, and a well-meaning
  // implementer materializing their derived redirects into static data is the specific
  // regression this pins.
  it("gives extraRedirects to exactly help and personaregistry", () => {
    const withRedirects = SITES.filter((s) => (s.extraRedirects ?? []).length > 0)
      .map((s) => s.id)
      .sort();
    expect(withRedirects).toEqual(["help", "personaregistry"]);
  });

  // `permanent` is NOT uniform, and the difference is deliberate. help's 10 are 308s
  // because the destination is final; personaregistry's 3 are 307s because — in its own
  // words — a 308 is cached by the browser indefinitely and would outlive any later change
  // to that URL grammar. Asserting the flag per site is what keeps a "tidy up, make them
  // all permanent" edit from silently burning three URLs into every visitor's cache.
  it("keeps help permanent and personaregistry temporary", () => {
    const help = findSite("help");
    const personaregistry = findSite("personaregistry");
    expect(help?.extraRedirects).toHaveLength(10);
    expect(help?.extraRedirects?.every((r) => r.permanent)).toBe(true);
    expect(personaregistry?.extraRedirects).toHaveLength(3);
    expect(personaregistry?.extraRedirects?.every((r) => !r.permanent)).toBe(true);
  });

  // The two sites that fail a hosted build with no API_BACKEND_URL. Asserting the exact
  // SET, not "bitbag is true", is what makes this catch the regression that matters — a
  // third site quietly gaining the flag fails its own deploy, and a site quietly losing it
  // deploys a proxy that 502s on every call.
  it("marks exactly bitbag and personaregistry as requiring a backend url", () => {
    const flagged = SITES.filter((s) => s.requiresBackendUrl)
      .map((s) => s.id)
      .sort();
    expect(flagged).toEqual(["bitbag", "personaregistry"]);
  });

  it("isSiteId accepts a real id and rejects a directory that is not a site", () => {
    expect(isSiteId("hub")).toBe(true);
    expect(isSiteId("node_modules")).toBe(false);
    expect(isSiteId("")).toBe(false);
  });
});
