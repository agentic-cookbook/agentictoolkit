// @agentic-toolkit/adh-ecosystem-panes — an ecosystem's own sub-resources, as panes.
//
// Applications, Storage Buckets, Users and Messaging are the four surfaces of an ecosystem
// that a host arranges on a rail but does not implement. They lived in the hub until the
// Products and Storage feature sites needed the same four: a second host meant either a
// second copy (which drifts) or one package (this).
//
// Why not `@agentic-toolkit/ecosystem-config`, where Auth / Feature flags / Server bags /
// Sign-in apps / Tokens / Billing already sit: these four are typed against
// `@agentic-toolkit/adh-api-types`, adh's generated OpenAPI bodies. That is the VOCABULARY
// tier, and a mechanism package may not import it (scripts/check_boundaries.py) — see this
// package's `comment:tier`. The split is the boundary the guard draws, not a taxonomy of
// what "configuration" means.
//
// Every pane takes the same `{ ecosystemId, title, help, leaf }` shape the sibling config
// panes take, so a host's topic switch reads uniformly across both packages. The ONE thing
// a host must supply beyond that is `renderTransfer` — see ./transfer-seam.
//
// Plus one arrangement of them: StorageGroup, the Buckets/Access/All Data rail, which has the
// same two-host problem the panes did.

export { ApplicationsPane } from "./applications/ApplicationsPane";
export { ApplicationDetail } from "./applications/ApplicationDetail";
export { AccessTokensSection } from "./applications/AccessTokensSection";

export { SchemasPane } from "./schemas/SchemasPane";
export { SchemaDefinitionDetail } from "./schemas/SchemaDefinitionDetail";

export { UsersPane } from "./users/UsersPane";
export { UserDetail } from "./users/UserDetail";

export { MessagingPane } from "./messaging/MessagingPane";

// Buckets / Access / All Data as one rail. Not a fifth pane but an ARRANGEMENT of three, and it
// is here because it too has two hosts: a workspace's promoted Storage rail and a product's
// Storage topic.
// Its URL grammar is NOT re-exported here: a host route parses before it renders, and on the hub
// that route is a Server Component, which this barrel's hoisted 'use client' would break. It has
// its own subpath — see ./storage/parse-path.
export { StorageGroup } from "./storage/StorageGroup";
export { AllDataPane } from "./storage/AllDataPane";

// The clients behind the panes. Exported because two of them are also DIRECTORIES a host
// injects elsewhere: `AccessPane` (in @agentic-toolkit/authentication) takes
// `usersDirectory` / `applicationsDirectory`, and those are exactly these two `.list`
// calls — the same rows the Users and Applications panes show, which is the point.
export { ecosystemUsersApi, type EcosystemUser, type EcosystemUserInput } from "./api/customers";
export {
  applicationsPrototypeApi,
  type PrototypeApplication,
  type ApplicationInput,
  type AccessToken,
} from "./api/applications-prototype";

// The host seam these panes could not bring out of the hub with them.
export type { RenderTransferSection, TransferSectionRequest } from "./transfer-seam";
