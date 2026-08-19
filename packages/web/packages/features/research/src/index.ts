// @agentic-toolkit/research — the Research feature: a master/detail surface over
// the signed-in user's markdown research documents (search, editor, publish flow).
// The entry mounts the deep-linked `/<slug>/research` route (the host passes
// `basePath`); the barrel exposes only the feature entry + the URL grammar it owns.
export { ResearchFeature } from "./ResearchFeature";

// The /research URL grammar, owned here so both hosts parse it identically.
// The URL grammar lives at the SERVER-SAFE ./parse subpath ONLY — deliberately NOT
// re-exported here: this barrel's dist is a "use client" module, so an RSC page that
// imported the parse helper from it would throw in prod (render-only client refs).

// The pane itself, exported so a host CAN render it directly — without ResearchFeature's
// basePath/URL wiring — with selection kept internal. The hub's
// `renderFeaturePanel("research")` arm is the only such call site and it is unreached
// (`research` is in no topic list), so today every render goes through ResearchFeature.
export { ResearchPane } from "./ResearchPane";
