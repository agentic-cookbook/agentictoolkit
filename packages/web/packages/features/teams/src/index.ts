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
// The URL grammar lives at the SERVER-SAFE ./parse subpath ONLY — deliberately NOT
// re-exported here: this barrel's dist is a "use client" module, so an RSC page that
// imported the parse helper from it would throw in prod (render-only client refs).

// The per-item SHARE PANEL (docs/workspace-roles-permissions.md §UI): the
// Inherited⇄Restricted mode row, the item's assignment list with per-row role
// selects, a subject picker, and the effective-permission explainer. Mounted as an
// HTD "Access" topic on a project (projects site) or persona (hub); the member
// directory is host-injected (the AccessPane usersDirectory seam).
export { ItemAccessPanel, type ItemAccessPanelProps } from "./ItemAccessPanel";
// The batteries-included subjects directory for ItemAccessPanel mounts (members +
// personas + teams from the shared platform APIs); hosts may still inject their own.
export { workspaceSubjectsDirectory } from "./subjects-directory";
export type { AccessSubject } from "./ItemAccessPanel";
