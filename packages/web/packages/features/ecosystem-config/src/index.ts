// @agentic-toolkit/ecosystem-config — the panes behind an ecosystem's CONFIGURATION group.
//
// The package is named for the ECOSYSTEM, not for any one owner: the hub mounts these panes for a
// product's ecosystem and for a workspace's default ecosystem, and the organizations site mounts
// them for an org's. Naming it after any of those three would have made the other two look like
// exceptions.
//
// `ConfigurationGroup` is the whole group behind one gate; the individual panes are exported too,
// because the hub arranges these rows on its own rail rather than through the group pane.
export { ConfigurationGroup, CONFIGURATION_DESCRIPTION } from "./ConfigurationGroup";

export { AuthPane } from "./AuthPane";
export { BillingPane } from "./BillingPane";
export { FeatureFlagsPane, FlagDialog } from "./FeatureFlagsPane";
export { ServerBagsPane, BagDialog } from "./ServerBagsPane";
export { SigninAppsPane } from "./SigninAppsPane";
export { SigninAppDetail } from "./SigninAppDetail";
export { StorageTokensPanel } from "./StorageTokensPanel";

// No help-text export. The sentences these panes show live in adh's site-config content package —
// the product's VOCABULARY tier, which a portable package may not import (scripts/check_boundaries.py).
// The host passes its own lookup in as `ConfigurationGroup`'s `helpFor`, and each pane already
// takes its blurb as a `help` prop.
