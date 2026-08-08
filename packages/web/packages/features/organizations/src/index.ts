// @agentic-toolkit/organizations — the Organizations feature: the caller's organizations as a
// list, and each one's Configuration / Members / Teams / Settings beside it.
//
// The feature is one export; the three below it are the pieces the HUB still mounts on its own
// (its workspace rail reaches Members and Settings directly, without this feature's list around
// them). They stay exported for exactly that reason — not as a general-purpose surface.

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
