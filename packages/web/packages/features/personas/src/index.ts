// @agentic-toolkit/personas — the Personas feature: a persona's identity, personality, purpose,
// knowledge, memory, and abilities, plus the persona-services (LLM provider connections) they run
// on. The list/table/editor internals are internal; the barrel exposes the sections (for a host
// that composes its own routing, e.g. the hub's PersonasGroupRoute/ServicesRoute), the site entry
// (for a host that just wants a mounted feature), and the URL grammar both share.
export { PersonasSection } from "./PersonasSection";
export { ServicesSection } from "./ServicesSection";
// PersonaEditor stays internal: every host reaches it through PersonasSection /
// PersonasFeature, and an exported 20-prop editor would freeze its internals as
// public API for consumers that don't exist.
// User Settings "Assistants" panel — per-user consent (Layer-2 may_act 'user') for the
// personas an owner has let act on the caller's behalf; a host mounts it standalone.
export { AssistantsPanel } from "./AssistantsPanel";

// The special-interests editor lives inside the Personality facet (PersonaEditor mounts it
// directly), but it's also exported standalone since it only needs a personaId.
export { InterestsEditor } from "./InterestsEditor";

// The interest research-corpus pane and the Knowledge facet it's mounted inside of.
// KnowledgeFacet lives inside the Knowledge facet (PersonaEditor mounts it directly), but both
// are exported standalone for the same reason as InterestsEditor above.
export { InterestDocumentsPane, KnowledgeFacet } from "./InterestDocumentsPane";

// The site entry: a thin, host-agnostic wrapper that drives PersonasSection's urlSelection from an
// explicit basePath — a feature site mounts this directly, no host-side glue needed.
export { PersonasFeature } from "./PersonasFeature";

// The Personas URL grammar, owned here so every host parses it identically.
// The URL grammar lives at the SERVER-SAFE ./parse subpath ONLY — deliberately NOT
// re-exported here: this barrel's dist is a "use client" module, so an RSC page that
// imported the parse helper from it would throw in prod (render-only client refs).

// The tool-provenance labelling (agent-tool-source.ts) is INTERNAL: its two consumers —
// the Abilities facet and the AssistantsPanel consent view — both live in this package now,
// so nothing outside imports the labelling directly.
