// Root entry — the drizzle-FREE surfaces only, so a non-DB consumer can import "."
// without installing the drizzle-orm peer. The drizzle-coupled surfaces (`./schema`,
// `./conn`, `./enumerate`) stay subpath-only and are imported directly.
export * from "./util/index.js";
export * from "./cooldown/index.js";
export * from "./canon/index.js";
export * from "./providers/index.js";
// The auto-configure engine is canon-only (drizzle-free), so it belongs on the root
// barrel alongside the other non-DB surfaces.
export * from "./engine/index.js";
