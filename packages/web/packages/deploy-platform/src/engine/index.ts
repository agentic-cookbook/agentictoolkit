// The auto-configure engine — the pure planner + classifier moved verbatim from the
// status web app, a generalized sequential apply-with-rollback runner, and the builder's
// project → site matcher. Drizzle-free (canon-only), so it re-exports from the root ".".
export * from "./plan.js";
export * from "./classify.js";
export * from "./run.js";
export * from "./builder-match.js";
