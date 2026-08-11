// @agentic-toolkit/authentication — the Authentication feature: API tokens and
// ecosystem bucket-access lists.
//
// AccessPane is the Ecosystems "Access" topic (every access list across an
// ecosystem's buckets, each badged with its bucket); TokensPanel is the user
// Settings "Tokens" panel (personal API-token create/list/revoke). The detail
// editor, its members/grants sub-editors, and the access-model helpers are
// internal — the barrel exposes only the two panes a host mounts, plus the
// props AccessPane needs a host to inject (its user/application directories
// stay host-owned; see AccessPane's prop docs).
//
// TokensFeature is the hierarchical view of BOTH token families (API ▸ token,
// Storage ▸ token), which the authentication site mounts at its home route.
// TokensPanel — the flat single-family panel — stays exported and unchanged
// because the hub's Settings ▸ Tokens topic still mounts it: two hosts, two
// surfaces, and only one of them was asked to change.
export { AccessPane, type AccessDirectoryApp, type AccessDirectoryUser } from "./AccessPane";
export { TokensPanel } from "./TokensPanel";
export { TokensFeature } from "./TokensFeature";
export {
  parseTokensPath,
  TOKEN_SECTIONS,
  type TokenSection,
  type TokensPathSelection,
} from "./parse-path";
