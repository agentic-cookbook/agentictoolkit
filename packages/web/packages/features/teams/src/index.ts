// @agentic-toolkit/teams — the Teams feature.
//
// A single TeamsFeature<basePath> orchestrates the team list ▸ its topics (Team ▸
// Members ▸ Permissions) over the resource substrate. It runs inside the hub's
// one-rail workspace shell (a rail host) — a site-less feature reached by direct
// URL (the hub has no dedicated Teams registry site). The panes are internal; the
// barrel exposes only the feature entry (the host passes `basePath` — the hub
// passes `/<slug>/teams`).
export { TeamsFeature } from "./TeamsFeature";

// The Teams URL grammar, owned here so a host can't drift its parsing away from
// what the feature expects.
export { parseTeamsPath, type TeamsPathSelection } from "./parse-path";
