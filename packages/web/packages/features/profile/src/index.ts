// @agentic-toolkit/profile — a PRINCIPAL's profile surface.
//
// The package is named for the principal, not for the user: `content.social_links` and
// `content.addresses` are owner-polymorphic, so an ORGANIZATION has these rows too. That is what
// lets the hub's User Settings and the organizations site's Settings rail render the same three
// panels over the same client (`@agentic-toolkit/data/profile`) rather than each growing its own.
//
// The panels are the mounting surface; the sections are exported beside them because the hub's
// own Profile editor arranges the sections directly, without the panel wrapper around them.
export { SocialLinksPanel } from "./SocialLinksPanel";
export { AddressesPanel } from "./AddressesPanel";
export { UsagePanel } from "./UsagePanel";

export { SocialLinksSection } from "./SocialLinksSection";
export { AddressesSection } from "./AddressesSection";
export { PrivacyLevelControl } from "./PrivacyLevelControl";
