// Organizations API client — re-exported from @agentic-toolkit/data/organizations
// rather than duplicated here. That package already ships an `organizationsApi`
// with the identical 5 methods (resolve/create/rename/archive/restore: same
// relative paths, same HTTP methods, same request bodies, same error handling)
// and the identical `Organization`/`OrganizationCreateInput`/`OrganizationProvisioned`/
// `OrganizationRenameInput`/`OrganizationRenamed`/`OrganizationRestored` wire types,
// transcribed from `adh-api-types` for the exact same MECHANISM-tier boundary reason
// this package hit (see check_boundaries.py's `_is_vocabulary`). This package
// already depends on `@agentic-toolkit/data`, so re-exporting keeps ONE maintained
// copy of this backend contract instead of two that can silently diverge on the
// next schema change.
//
// Only `.restore` is called by anything moving into this package (ArchivedPanel, in
// a later task) — the other four methods come along because `organizationsApi` is a
// single exported binding, not five. That's the same shape as `auth.ts`'s
// `checkSlugAvailable` re-export and `workspaces.ts`'s `WORKSPACES_QUERY_KEY`
// re-export: take the whole named export from `@agentic-toolkit/data` rather than
// re-declaring a narrower copy.
export {
  organizationsApi,
  type Organization,
  type OrganizationCreateInput,
  type OrganizationProvisioned,
  type OrganizationRenameInput,
  type OrganizationRenamed,
  type OrganizationRestored,
} from "@agentic-toolkit/data/organizations";
