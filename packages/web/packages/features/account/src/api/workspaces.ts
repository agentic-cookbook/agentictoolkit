// Workspaces API — moved from adh's hub (frontend/src/sites/hub/src/api/workspaces.ts).
// Only the query key is copied: it's the one export the settings panels use (the
// Archived panel invalidates it after a restore so the switcher's live workspace
// list picks the restored org back up). `useWorkspaces` and the `WorkspaceList`/
// `WorkspaceDto` types stay in hub — nothing under Tasks 4-6 references them.
//
// `WORKSPACES_QUERY_KEY` is itself a plain re-export in hub's copy (not a
// `SuccessBody`/`RequestBody` type), so there is no adh-api-types boundary
// question here — it is sourced straight from `@agentic-toolkit/data`, the same
// place hub's own `workspaces.ts` gets it from.
export { WORKSPACES_QUERY_KEY } from "@agentic-toolkit/data";
