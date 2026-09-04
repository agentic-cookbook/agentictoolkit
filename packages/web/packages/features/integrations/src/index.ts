// @agentic-toolkit/integrations — the Integrations feature: a DESTINATION (the workspace, a
// persona it owns, a product it owns) and the provider-config instances connected to it.
//
// Every integration binds to an ecosystem, so a destination is ultimately a way of NAMING one;
// what differs between the three kinds is only how that ecosystem is reached. See
// `destinations.ts`.

// The URL-owning entry: the destinations rail plus the pane, mounted at a `basePath`.
export { IntegrationsFeature, type IntegrationsFeatureProps } from "./IntegrationsFeature";

// The pane without the destinations rail, for a host that already routes its own surface — the
// hub embeds this per product (Products ▸ <product> ▸ Integrations) and at the workspace level,
// resolving the ecosystem itself.
export { IntegrationsPane, addressOf, mergeFetchedRow } from "./IntegrationsPane";

// The destination model, exported because a host that mounts the PANE still has to answer "which
// ecosystem?" and this is where that question is answered for the three kinds.
export {
  useIntegrationDestinations,
  resolveDestination,
  WORKSPACE_DESTINATION_ID,
  type DestinationKind,
  type IntegrationDestination,
  type IntegrationDestinationsResult,
} from "./destinations";

// The provider redirect landing. `oauthCallbackUrl()` is ORIGIN-RELATIVE, so every site that
// starts an OAuth connect must mount this at its own `/integrations/oauth-callback` — the
// provider returns to the origin the connect began on, not to a shared one.
//
// A route that mounts ONLY this should import it from the ./oauth-callback subpath instead:
// the callback is a leaf, but this barrel is the whole feature, so mounting it from here
// makes a page whose entire job is a spinner and a fetch ship the panes, the dialogs and the
// tables as well. The re-export stays for the hosts that render the feature anyway.
export { IntegrationsOAuthCallback } from "./IntegrationsOAuthCallback";

// The sessionStorage stash the callback reads: the connect context can't survive the provider
// round-trip in React state, so it is keyed by the signed `state` parameter.
export {
  CONNECTIONS_HASH,
  FALLBACK_RETURN_TO,
  currentReturnTo,
  stashPendingConnect,
  hasPendingConnect,
  readPendingConnect,
  markPendingConnectConsumed,
  wasPendingConnectConsumed,
  consumedReturnTo,
  clearPendingConnect,
  type PendingOAuthConnect,
  type RedirectAuthMethod,
} from "./oauth-callback-store";

// The integrations URL grammar lives at the SERVER-SAFE ./parse subpath ONLY, and is deliberately
// NOT re-exported here: this barrel's dist is a "use client" module, so an RSC page importing the
// parser from it would throw in prod (render-only client refs).
