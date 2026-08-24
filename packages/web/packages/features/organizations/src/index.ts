// @agentic-toolkit/organizations — the Organizations feature: the caller's organizations as a
// list, and each one's Server bags / Tokens / Teams / Settings beside it.
//
// The feature is one export; the three below it are the pieces the HUB still mounts on its own
// (its workspace rail reaches Members and Settings directly, without this feature's list around
// them). They stay exported for exactly that reason — not as a general-purpose surface.
//
// `MembersPanel` is now mounted from BOTH sides — by the hub's own `/<slug>/members` route, and
// by `OrgSettingsGroup` as this feature's Settings ▸ Members row — which is why it takes its
// workspace as props rather than reading a context only one of them has.

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
