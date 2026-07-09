// @agentic-toolkit/narratives — the Narratives feature.
//
// The hub route mounts NarrativesFrame directly today (a self-contained iframe
// embed of the published static narratives bundle); NarrativesFeature is the
// grouping-shell surface for a future route (see its docstring) and is exported
// alongside it so both are available to consumers.
export { NarrativesFrame } from "./NarrativesFrame";
export { NarrativesFeature } from "./NarrativesFeature";
