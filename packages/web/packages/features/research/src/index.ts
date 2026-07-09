// @agentic-toolkit/research — the Research feature: a master/detail surface over
// the signed-in user's markdown research documents (search, editor, publish flow).
// The entry mounts the deep-linked `/<slug>/research` route (the host passes
// `basePath`); the barrel exposes only the feature entry + the URL grammar it owns.
export { ResearchFeature } from "./ResearchFeature";

// The /research URL grammar, owned here so both hosts parse it identically.
export { parseResearchPath, type ResearchPathSelection } from "./parse-path";

// The embedded pane, exported for the hub's ecosystem topic-rail usage
// (`renderFeaturePanel("research")` in feature-panels.tsx), which renders it
// directly — without ResearchFeature's basePath/URL wiring — so opening a document
// happens in place instead of navigating the workspace away.
export { ResearchPane } from "./ResearchPane";
