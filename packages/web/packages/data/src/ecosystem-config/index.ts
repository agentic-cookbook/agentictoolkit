// @agentic-toolkit/data/ecosystem-config — the clients behind an ecosystem's CONFIGURATION
// group: its feature flags, its server bags, the sign-in apps it vends, and the storage token
// principals scoped to it.
//
// One sub-entry rather than four, because they are one rail group with one lifetime: a host
// that mounts the Configuration topic wants all of them, and a host that doesn't wants none.

export * from "./feature-flags";
export * from "./server-bags";
export * from "./signin-apps";
export * from "./storage-tokens";
