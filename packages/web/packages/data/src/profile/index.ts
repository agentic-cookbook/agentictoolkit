// @agentic-toolkit/data/profile — a PRINCIPAL's profile record: its social links, addresses,
// the per-row privacy grants that decide who sees them, and its metered usage.
//
// One entry for four endpoints because they answer about one subject and are read together:
// the same `?workspace=<slug>` decides whose profile every one of them means (absent → the
// caller's own; present → an organization's), and every list key here is namespaced by that
// same owner segment. Splitting usage out would put half of one owner-scoping rule in another
// module and invite the two halves to drift.
//
// A profile belongs to a principal, NOT to a user: `content.social_links` and
// `content.addresses` are owner-polymorphic, so an organization has these rows too. That is
// what lets the hub's User Settings and an org workspace's Settings render the same panels.

export * from "./profile";
export * from "./usage";
