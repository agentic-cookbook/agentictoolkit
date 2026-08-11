// @agentic-toolkit/organizations — the Organizations feature: the caller's organizations as a
// list, and each one's Server bags / Tokens / Teams / Settings beside it.
//
// The feature is one export; the three below it are the pieces the HUB still mounts on its own
// (its workspace rail reaches Members and Settings directly, without this feature's list around
// them). They stay exported for exactly that reason — not as a general-purpose surface, and in
// `MembersPanel`'s case not because this feature has a Members topic: it hasn't, since membership
// is what an org's Teams answer.

export { OrganizationsFeature, type OrganizationsFeatureProps } from "./OrganizationsFeature";
export { NewOrganizationModal } from "./NewOrganizationModal";
export { MembersPanel } from "./MembersPanel";
export {
  OrgSettingsGroup,
  OrgSettingsPane,
  OrgSettingsForm,
  ORG_SETTINGS_DESCRIPTION,
  type OrgSettingsHrefs,
} from "./OrgSettingsPane";
