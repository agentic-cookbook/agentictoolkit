/** Sidebar topics inside a PRODUCT (the Products FTD — each product IS an ecosystem).
 * The LAST topic ("Ecosystem Settings", id "settings" for deep-link stability) is the
 * entity pane itself — it edits the product's own fields and holds the Danger (delete)
 * section (see FTD spec §4–§5). Creating products happens on the Products landing / the
 * selector popup's "New Product…" dialog (rendered above these).
 *
 * Storage / Users are GROUP topics: each renders a nested topic→detail sub-rail
 * of its members (defined in the toolkit's EcosystemsFeature), not a single pane —
 * Storage = Buckets / Access / All Data, Users (topic id "invitations", for deep-link
 * stability) = Users / Requests / Pending users / Invites.
 *
 * These rows are all scoped to the OPEN PRODUCT's ecosystem. Several of them name a surface
 * that ALSO exists at workspace level, scoped to the workspace's default ecosystem instead —
 * Storage on agenticdeveloperstorage.com, Integrations on agenticdeveloperintegrations.com,
 * Tokens on the hub's own rail. Same pane, different scope; the split is deliberate and this
 * list is not the place to reconcile it.
 *
 * A plain data module, and its own package entry (`@agentic-toolkit/adh-products/topics`), so a
 * Server Component that only needs an id or a label does not drag the feature onto the client.
 *
 * It lives here rather than in the hub because BOTH hosts of the Products feature render it, and
 * a copy per host is two rails that nothing makes agree. */
export const PRODUCT_TOPICS = [
  // The product's auto-provisioned project (subject-linked at create / deploy backfill).
  { id: "project", label: "Project", dividerAfter: false },
  { id: "storage", label: "Storage", dividerAfter: false },
  { id: "integrations", label: "Integrations", dividerAfter: false },
  // Messaging: send email/SMS to this product's customers via its OWN connected
  // Postmark/Twilio integration (the promoted admin Messaging tool). Always shown; each
  // channel is disabled until its provider is connected on Integrations.
  { id: "messaging", label: "Messaging", dividerAfter: false },
  { id: "tokens", label: "Tokens", dividerAfter: false },
  { id: "applications", label: "Applications", dividerAfter: false },
  { id: "dashboards", label: "Dashboards", dividerAfter: true },
  { id: "invitations", label: "Users", dividerAfter: false },
  // Vended sign-in CLIENTS (oauth.clients) for this product's customer realm — the apps a
  // developer registers so their site can sign its own customers in via GitHub-through-ADH.
  { id: "signin-apps", label: "Sign-in apps", dividerAfter: false },
  { id: "communities", label: "Communities", dividerAfter: false },
  // The product's gamification REALM: enable/disable, skin, and per-surface toggles
  // (badges / leaderboards / streaks / recaps) — an engagement surface over its members.
  { id: "gamification", label: "Gamification", dividerAfter: false },
  // Explicit per-product auth policy (signup mode / login enabled) for this
  // product's vended customer realm — the conceptual "Auth settings" home.
  { id: "auth", label: "Auth", dividerAfter: false },
  // Per-product feature flags + server bags — named on/off toggles and arbitrary
  // key → JSON config values this product's apps / backend read at runtime.
  { id: "feature-flags", label: "Feature flags", dividerAfter: false },
  { id: "server-bags", label: "Server bags", dividerAfter: false },
  { id: "billing", label: "Billing", dividerAfter: true },
  // The product's own entity/settings pane (name/slug/description + Danger). Last in the
  // rail; selected by id === "settings" in the toolkit's EcosystemsFeature.
  { id: "settings", label: "Ecosystem Settings", dividerAfter: false },
] as const;

export type ProductTopicId = (typeof PRODUCT_TOPICS)[number]["id"];

/**
 * The product topics whose pane this package does NOT own, so every host must render them
 * itself through {@link ProductsFeatureProps.renderFeaturePanel}.
 *
 * Exported as data rather than left implicit in a switch's fall-through because it is the whole
 * contract of that seam, and a host has no other way to know what it will be asked for. The
 * package's own test asserts it against PRODUCT_TOPICS, so a topic added above without a pane
 * here fails loudly instead of rendering blank.
 *
 * "all-data" is not a topic — it is the third member of the Storage GROUP, reached through the
 * same seam, which is why it is listed with them.
 */
export const HOST_RENDERED_TOPIC_IDS = [
  "dashboards",
  "communities",
  "billing",
  "all-data",
] as const;
