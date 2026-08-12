// @agentic-toolkit/account — the portable half of a user's settings surface.
//
// MECHANISM tier: this package must never import @agentic-toolkit/adh* (see
// scripts/check_boundaries.py and the tier comment in package.json). Populated by
// the following tasks.
export { SettingsLayout, type Topic } from "./layout/SettingsLayout";
export { SettingsPanel } from "./layout/SettingsPanel";
export { SettingRow } from "./layout/SettingRow";
// The section-switching channel SettingsLayout publishes to the panels inside it. Exported
// because it is part of that public component's contract, and because a host that renders
// these panels OUTSIDE the rail (hub's workspace-settings stack) can supply its own.
export {
  SettingsNavProvider,
  useSettingsNav,
  type SettingsNav,
} from "./layout/settings-nav";

// The typed HTTP wrappers the settings panels call — moved from adh's hub
// (frontend/src/sites/hub/src/api/*). `http.ts` and `profile.ts` were pure
// re-export shims over `@agentic-toolkit/auth/client` and
// `@agentic-toolkit/data/profile` respectively and are deliberately NOT copied
// here — a consumer imports those two straight from the upstream package instead
// of through this one. See `./api/auth.ts`'s header for why the request/response
// types below are transcribed rather than imported from `@agentic-toolkit/adh-api-types`.
export {
  ME_QUERY_KEY,
  checkSlugAvailable,
  changePassword,
  updateMe,
  useCurrentUser,
  type Me,
} from "./api/auth";
export {
  addContact,
  confirmContactVerification,
  deleteContact,
  listContacts,
  listPreferences,
  savePreferences,
  startContactVerification,
  type AddContactBody,
  type ContactMethod,
  type NotificationPref,
  type NotificationPrefInput,
} from "./api/account";
export {
  organizationsApi,
  type Organization,
  type OrganizationCreateInput,
  type OrganizationProvisioned,
  type OrganizationRenameInput,
  type OrganizationRenamed,
  type OrganizationRestored,
} from "./api/organizations";
export {
  ARCHIVED_WORKSPACES_QUERY_KEY,
  useArchivedWorkspaces,
  type ArchivedWorkspace,
  type ArchivedWorkspaceList,
} from "./api/archived-workspaces";
export { WORKSPACES_QUERY_KEY } from "./api/workspaces";

// The self-contained panels — no cross-panel state, no adh vocabulary — moved from
// adh's hub (frontend/src/sites/hub/src/components/settings/panels/*).
export { AccountPanel } from "./panels/AccountPanel";
export { SubscriptionPanel } from "./panels/SubscriptionPanel";
export { ArchivedPanel } from "./panels/ArchivedPanel";
export { ProfilePanel, type ProfilePanelProps } from "./panels/ProfilePanel";
export { ContactInfoPanel } from "./panels/ContactInfoPanel";

// The notifications/security workspaces — the same move, but from hub's own
// components/notifications/* and components/security/*, not settings/panels/* above.
export { ContactsCard, type ContactsCardProps } from "./notifications/ContactsCard";
export { SecurityWorkspace } from "./security/SecurityWorkspace";
export { NotificationsWorkspace } from "./notifications/NotificationsWorkspace";
export { PreferencesCard } from "./notifications/PreferencesCard";
