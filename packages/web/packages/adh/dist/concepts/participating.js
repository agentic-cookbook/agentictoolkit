// src/concepts/participating.ts
var CONCEPT_SITE_IDS = /* @__PURE__ */ new Set([
  "academy",
  "authentication",
  "billing",
  "communities",
  "community",
  "consulting",
  "customers",
  "dashboards",
  "devices",
  "devteam",
  "domains",
  "ecosystems",
  "education",
  "knowledgebases",
  "narratives",
  "news",
  "notifications",
  "personas",
  "products",
  "projects",
  "recipes",
  "registries",
  "sites",
  "storage",
  "support",
  "tools",
  "teamregistry",
  "teambuilder",
  "codereviews",
  "personabuilder",
  "research",
  "consultants"
]);
function isConceptSite(siteId) {
  return CONCEPT_SITE_IDS.has(siteId);
}
export {
  CONCEPT_SITE_IDS,
  isConceptSite
};
//# sourceMappingURL=participating.js.map