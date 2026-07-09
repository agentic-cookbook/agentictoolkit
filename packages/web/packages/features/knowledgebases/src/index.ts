// @agentic-toolkit/knowledgebases — the Knowledge Bases feature: CRUD data views over the
// persona-memory tables, in the one merged stack (the hub's rail-host, or standalone on a feature
// site's /home). The panel is internal; the barrel exposes the feature entry (the host passes
// `basePath` + the `tables` it resolved from its own catalogs) and the URL parse both hosts share.
export { KnowledgeBasesFeature } from "./KnowledgeBasesFeature";

// The /home Knowledge Bases URL grammar, owned here so both hosts parse it identically.
export { parseKnowledgeBasesPath, type KnowledgeBasesPathSelection } from "./parse-path";

// KnowledgeBasesPane is ALSO exported directly (not just via KnowledgeBasesFeature) because the
// hub's persona editor (PersonaEditor.tsx, extracted by a separate wave) embeds it as a facet of
// the persona workspace — not as a standalone routed feature — and needs the bare pane, not the
// basePath-carrying feature entry.
export { KnowledgeBasesPane } from "./KnowledgeBasesPane";
