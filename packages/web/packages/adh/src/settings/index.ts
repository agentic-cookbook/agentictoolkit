// The User Settings surface every site mounts: a light, always-loaded barrel
// (this file) plus a heavy, lazily-fetched panel graph reached only through the
// `UserSettingsOverlay` entry — see that file's own bottom comment for why the two
// are not the same tsup entry.
//
// CORRECTNESS RULE, not a bundling nicety: SETTINGS_TOPICS/DEFAULT_SETTINGS_TOPIC/
// resolveSettingsTopic/SettingsTopicId must NOT be re-exported from this file — import
// them from "@agentic-toolkit/adh/settings/topics" directly, never through this barrel.
// This file imports "./settings-overlay" below, which is "use client"; tsup's
// esbuild-plugin-preserve-directives hoists a chunk's directive onto every entry that
// reaches it, so the BUILT dist/settings/index.js — the "import" condition every
// production build resolves to — opens with "use client" as a whole. topics.ts itself
// carries no directive, but re-exporting it from here would make it reachable ONLY
// through a client-tainted file: a Server Component importing SETTINGS_TOPICS through
// this barrel would get a client reference it cannot call .map() on, not the real array.
// The trap is that this is invisible everywhere except a production build: the
// "development" condition resolves to this raw .ts source, where Next's own compiler
// applies "use client" per FILE rather than hoisting it across a bundled chunk, so dev,
// vitest and every guard here stay green while only `next build` fails. topics.ts's own
// tsup entry has no such taint (nothing it imports is a client module), which is why it
// is the one and only route to these four exports — see topics.ts's own header comment.
export { SettingsOverlayProvider, useSettingsOverlay } from "./settings-overlay";

// SECOND CORRECTNESS RULE, and the reason those two names are the ONLY thing above:
// UserSettingsOverlay/buildSettingsTopics/SettingsTab must NOT be re-exported from here
// either — in ANY form, static or type-only. A host that wants them (hub's /settings route
// is the only one) imports "@agentic-toolkit/adh/settings/UserSettingsOverlay" directly,
// which is its own tsup entry and therefore its own chunk.
//
// This file used to carry `export { UserSettingsOverlay, buildSettingsTopics, SettingsTab,
// type Topic } from "@agentic-toolkit/adh/settings/UserSettingsOverlay"`, justified by "a
// static re-export of an unused name costs a tree-shaking consumer nothing (`sideEffects`
// names only `**/*.css`)". That was measured against real consuming builds and it is FALSE
// under Turbopack, which is what every site in the fleet builds with. The `lazy(() =>
// import("@agentic-toolkit/adh/settings/UserSettingsOverlay"))` in settings-overlay.tsx
// genuinely splits the chunk graph — and then a sibling STATIC re-export of the identical
// specifier, from this barrel that every site's shell loads unconditionally, pulls the same
// module back into the EAGER graph, after which the dynamic import merely resolves to a
// chunk that is already there. Evidence: production builds of `recipes`, `notebook` and
// `status` had panel-only strings ("Preferred 2FA method", "This slug is already taken",
// "Minimise animations and transitions") in their eager <script src> chunks. The
// discriminator is `HelpWindow`, inside this same package: dynamic PLUS a static
// `export { HelpWindow } from '@agentic-toolkit/adh/help/HelpWindow'` in help/index.ts, and
// its panel-only strings ARE in those same eager chunks. Settings had HelpWindow's shape,
// and deleting the static re-export is what took it out of the eager graph. (`BitbagDock`
// looks like the matching negative control — dynamic-only, absent from the eager chunks —
// but it is absent from EVERY chunk of all four sites, so it discriminates nothing.)
//
// So a name added here is not free: it costs every page of ~45 sites the entire module graph
// that name reaches. Measured on the four production builds that removed it: eager JS fell
// by 744,739 B (-10.8%) on recipes, 425,095 B (-7.9%) on notebook and 356,484 B (-8.5%) on
// status — on the order of 350 kB per page — for a dialog a signed-out visitor cannot open
// at all.
// tools/check-settings-boundary.py fails the build if this barrel grows a static reach for
// that entry again; it cannot see a consumer's chunk graph, but it can see this one line.
