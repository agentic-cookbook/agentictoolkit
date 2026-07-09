// @agentic-toolkit/ecosystems — the Ecosystems feature.
//
// Host-composed: the entry takes the host's ecosystem-scoped topic rail config, its
// non-ecosystems feature-panel renderer, and its config-pane renderer for the topics
// this feature reuses but doesn't own (Applications / Integrations / Buckets / Access /
// Users) — see EcosystemsFeature's prop doc comments.

export { EcosystemsFeature, IN_PACKAGE_TOPICS } from "./EcosystemsFeature";
export type {
  EcosystemsFeatureProps,
  EcosystemsTopicConfig,
  RenderTopicPaneCtx,
} from "./EcosystemsFeature";

export { parseEcosystemsPath } from "./parse-path";
export type { EcosystemsPathSelection } from "./parse-path";

// The opt-in per-ecosystem capability gate — also consumed standalone by the hub's
// /messaging route (no ecosystem in its own URL), so it's exported at top level.
export {
  useEcosystemCapabilities,
  useHasMessaging,
  MESSAGING_CAPABILITY,
} from "./use-ecosystem-capabilities";
export type { EcosystemCapabilities } from "./use-ecosystem-capabilities";
