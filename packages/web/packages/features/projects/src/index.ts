// @agentic-toolkit/projects — the Projects feature.
//
// A single ProjectsFeature<basePath> orchestrates the project rail ▸ its topics
// (Overview ▸ Work Items ▸ Activity) over the resource substrate. It runs inside
// the hub's one-rail workspace shell (a rail host) and, standalone, on a feature
// site's /home. The panes/views/editor are internal; the barrel exposes only the
// feature entry (the host passes `basePath` — `/<slug>/projects` in the hub,
// `/home/<slug>` on the projects site).
export { ProjectsFeature } from "./ProjectsFeature";

// The "Project" topic of a product/persona: resolves the subject's auto-provisioned
// project and renders the standard overview pane for it — host-injected into the
// product topic rail (hub ProductsTab) and the persona editor (host seams).
export { SubjectProjectPane } from "./SubjectProjectPane";

// The /home Projects URL grammar, owned here so both hosts parse it identically.
// The URL grammar lives at the SERVER-SAFE ./parse subpath ONLY — deliberately NOT
// re-exported here: this barrel's dist is a "use client" module, so an RSC page that
// imported the parse helper from it would throw in prod (render-only client refs).
