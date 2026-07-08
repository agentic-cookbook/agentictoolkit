// @agentic-toolkit/projects — the Projects feature.
//
// A single ProjectsFeature<basePath> orchestrates the project rail ▸ its topics
// (Overview ▸ Work Items ▸ Activity) over the resource substrate. It runs inside
// the hub's one-rail workspace shell (a rail host) and, standalone, on a feature
// site's /home. The panes/views/editor are internal; the barrel exposes only the
// feature entry (the host passes `basePath` — `/<slug>/projects` in the hub,
// `/home` on the projects site).
export { ProjectsFeature } from "./ProjectsFeature";

// The /home Projects URL grammar, owned here so both hosts parse it identically.
export { parseProjectsPath, type ProjectsPathSelection } from "./parse-path";
