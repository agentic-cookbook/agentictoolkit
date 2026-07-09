// @agentic-toolkit/dashboards — the Dashboards (Site Monitoring) feature.
//
// A single DashboardsFeature<basePath> orchestrates the Groups/Sites rail ▸ each
// section's master/detail editor (group/site fields, plus a site's endpoints) over
// the resource substrate. The panes/sections/editors are internal; the barrel
// exposes only the feature entry (the host passes `basePath` — `/<slug>/dashboards`
// in the hub) and the URL grammar so every host parses the same path identically.
export { DashboardsFeature } from "./DashboardsFeature";

// The Dashboards URL grammar, owned here so every host parses it identically.
export { parseDashboardsPath, type DashboardsPathSelection } from "./parse-path";
