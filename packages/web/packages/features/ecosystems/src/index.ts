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

// The URL grammar lives at the SERVER-SAFE ./parse subpath ONLY — deliberately NOT
// re-exported here: this barrel's dist is a "use client" module, so an RSC page that
// imported the parse helper from it would throw in prod (render-only client refs).
export type { EcosystemsPathSelection } from "./parse-path";

// The opt-in per-ecosystem capability gate — also consumed standalone by the hub's
// /messaging route (no ecosystem in its own URL), so it's exported at top level.
export {
  useEcosystemCapabilities,
  useHasMessaging,
  MESSAGING_CAPABILITY,
} from "./use-ecosystem-capabilities";
export type { EcosystemCapabilities } from "./use-ecosystem-capabilities";
