// @agentic-toolkit/personas — the Personas feature: a persona's identity, personality, purpose,
// knowledge, memory, and abilities, plus the persona-services (LLM provider connections) they run
// on. The list/table/editor internals are internal; the barrel exposes the sections (for a host
// that composes its own routing, e.g. the hub's PersonasGroupRoute/ServicesRoute), the site entry
// (for a host that just wants a mounted feature), and the URL grammar both share.
export { PersonasSection } from "./PersonasSection";
export { ServicesSection } from "./ServicesSection";
export { PersonaEditor } from "./PersonaEditor";

import type { ComponentProps } from "react";
import type { PersonasSection } from "./PersonasSection";
import type { ServicesSection } from "./ServicesSection";
import type { PersonaEditor } from "./PersonaEditor";
export type PersonasSectionProps = ComponentProps<typeof PersonasSection>;
export type ServicesSectionProps = ComponentProps<typeof ServicesSection>;
export type PersonaEditorProps = ComponentProps<typeof PersonaEditor>;

// The site entry: a thin, host-agnostic wrapper that drives PersonasSection's urlSelection from an
// explicit basePath — a feature site mounts this directly, no host-side glue needed.
export { PersonasFeature } from "./PersonasFeature";

// The Personas URL grammar, owned here so every host parses it identically.
export { parsePersonasPath, type PersonasPathSelection } from "./parse-path";

// The tool-provenance labelling shared by this feature's Abilities facet and a host's own
// per-user consent view (e.g. the hub settings AssistantsPanel) — kept as a small standalone
// module (agent-tool-source.ts) so a host can depend on just the labelling without the rest of
// the feature, re-exported here as the package's public surface for it.
export { BUILT_IN, sourceLabel, groupBySource } from "./agent-tool-source";
