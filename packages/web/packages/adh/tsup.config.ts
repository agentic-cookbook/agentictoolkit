import { defineConfig } from 'tsup'
import { preserveDirectivesPlugin } from 'esbuild-plugin-preserve-directives'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    server: 'src/server.ts',
    'header/index': 'src/header/index.ts',
    // Its own entry so the preserved import below has something to resolve to.
    'header/recents': 'src/header/recents.ts',
    // The pluggable header AUTH SOURCES (Task 6.2) — the `HeaderAuthState`/
    // `HeaderAuthSource` contract plus the anonymous and smart-SSO sources. Its own
    // entry, published as the `./header-auth` subpath, rather than a member of
    // `header/index`: this is the only module in the header directory that value-imports
    // `@agentic-toolkit/auth`, and folding it into the always-loaded header barrel would
    // put the auth package in front of every consumer of a nav link. Reaches
    // AdhHeader/AvatarMenu by TYPE only, so no relative-inlining hazard (see the file).
    'header/header-auth': 'src/header/header-auth.ts',
    'flags/index': 'src/flags/index.ts',
    'footer/index': 'src/footer/index.ts',
    // The page shell (AdhAppShell) plus the generic error family — the boundaries, the
    // themed fallback, the stale-deploy chunk recovery, the dev switches. Task 5.8. The
    // adh-specific half (which providers wrap the shell, the site-registry lookups
    // HomePlaceholder/SiteNotFound take as props here) merged into this same entry when
    // the app tier came across — see the vocabulary-tier block below.
    'layout/index': 'src/layout/index.ts',
    'legal/index': 'src/legal/index.ts',
    'themes/index': 'src/themes/index.ts',
    // The two dev-only halves of theming, each its OWN entry so a production build can
    // leave them out — see the chunk-gate contract in adh-registry's src/deployment-env.ts. DbThemeApplier
    // is also the only 'use client' module in the themes graph, so hoisting it out is what
    // keeps `themes/index` (AdhThemeStyle + the switcher payload builder) server-only.
    'themes/DbThemeApplier': 'src/themes/DbThemeApplier.tsx',
    'themes/theme-preview': 'src/themes/theme-preview.ts',
    'debug/index': 'src/debug/index.ts',
    // The environment/debug CONSOLE — this package's own `debug/` (env-var inventory)
    // and `debug-console/` (the floating window) merged into one directory, because the
    // `./debug` subpath above was already taken. Its two host-owned surfaces (the env
    // override store, the theme taxonomy) arrive as props — see src/debug-env/seams.ts.
    'debug-env/index': 'src/debug-env/index.ts',
    // The site-theme EDITOR (theme-editor state + the injected THEME_AREAS taxonomy + the
    // Monaco CSS editor), reached only through the env-gated dynamic import in
    // debug-env/DebugConsole.tsx. Its own entry is one of the four legs of that gate — see
    // the chunk-gate contract in adh-registry's src/deployment-env.ts.
    'debug-env/SiteThemeConsole': 'src/debug-env/SiteThemeConsole.tsx',
    // The Help modal. `help/index` is the always-loaded barrel (HelpProvider context + useHelp +
    // topic data); the heavy window (the ~87K pre-rendered markdown corpus + shiki + the API
    // browser) is its OWN entry so HelpProvider's `next/dynamic(() =>
    // import('@agentic-toolkit/adh/help/HelpWindow'))` has a real subpath to resolve, and the
    // matching `external` keeps that specifier a dynamic import in the built help/index.js rather
    // than inlining the window and evaluating it eagerly on every page.
    //
    // A caveat used to live here, inherited from the pre-rename `@adh-shared/adh`: that barrel
    // re-exported the window RELATIVELY (`export { HelpWindow } from './HelpWindow'`), which
    // bypassed `external` and inlined a second copy of the corpus — dist/help/index.js was
    // 98,970 B. The barrel now re-exports it by package path, so the copy is gone: today's
    // dist/help/index.js is ~7 KB and both of its references to the window are specifiers, not
    // bodies. The static re-export that remains costs nothing to a tree-shaking consumer either
    // (`sideEffects` names only `**/*.css`, so an unused JS re-export is dropped), which is why
    // it can stay a public name. Do not restore a relative form here.
    'help/index': 'src/help/index.ts',
    'help/HelpWindow': 'src/help/HelpWindow.tsx',
    // The SSR help surface (server component) + its topic-tree helpers, for the help SITE.
    // `surface` stays a server module by keeping the interactive rail (help/HelpMasterDetail,
    // 'use client') as its OWN chunk it imports by package path — the same directive-isolation
    // trick as themes/DbThemeApplier. Kept un-inlined via the matching `external`.
    'help/surface': 'src/help/surface.ts',
    'help/HelpMasterDetail': 'src/help/HelpMasterDetail.tsx',
    // The ADH docs shell (server component: sidebar + article). No context/state, so it needs no
    // external self-entry like help — a plain entry the consumer resolves to dist/ in prod.
    'docs/index': 'src/docs/index.ts',
    // Pure Save-gates for the ecosystem settings dialogs admin and hub both render
    // (server bags, feature flags). No React — its own light entry so a dialog can
    // import the gate without pulling a UI barrel.
    'settings-dialogs/index': 'src/settings-dialogs/index.ts',
    // The shared persona-chat backend (SSE parser + status/retry state machine +
    // PersonaChatBackend class). Pure TS, no React. The auth-aware fetchers are
    // INJECTED by the consumer; the chat contract types are a traceable local copy
    // (src/persona-chat/chat-types.ts) rather than a cross-submodule dependency.
    'persona-chat/index': 'src/persona-chat/index.ts',
    // The VISITOR chat backend (anonymous, token-minting) — same shape, no auth.
    'visitor-chat/index': 'src/visitor-chat/index.ts',
    'telemetry/index': 'src/telemetry/index.ts',
    'telemetry/retry': 'src/telemetry/retry.ts',
    'telemetry/report-error': 'src/telemetry/report-error.ts',
    // The telemetry-wired AuthProvider + appearance sync (Task 6.1). Reaches the two
    // telemetry leaves above by package path (see wired-provider.tsx/AppearanceSync.tsx
    // import comments) so this new entry shares their module state rather than inlining
    // a private copy.
    'auth/index': 'src/auth/index.ts',

    // ── The adh VOCABULARY tier, merged in from the former `@adh/chrome` ─────────────
    // These directories were an adh-owned package under `frontend/src/app/chrome/`
    // until they moved here wholesale. A repo outside adh cannot reach into adh's app
    // tier, so "shared chrome that only adh can consume" was a contradiction; the whole
    // tier came across. The entry/`external` pairings below are chrome's own, carried
    // over verbatim — every one of them is load-bearing (see the `external` notes).

    // The concept TAXONOMY: `structure.json` + the locale content catalogs assembled at
    // module load into `conceptTree` plus six derived indexes (conceptById, conceptIds,
    // detailTopics, …). Heavy module-level state AND the site-config JSON is inlined
    // here (see `noExternal` below), so an entry that reached it relatively would carry
    // its own second copy of both. Every reaching module writes the package path.
    'concepts/index': 'src/concepts/index.ts',
    // The participation leaf on its own: the header's "Details" link needs to know
    // whether THIS site has a concept page, and pulling the whole taxonomy (plus its
    // JSON) into the always-loaded header entry to answer one boolean is the thing this
    // split exists to prevent.
    'concepts/participating': 'src/concepts/participating.ts',
    // bitbag in the footer — 'use client', `next/dynamic`-imported by FooterChat with
    // `ssr: false`. Its own entry so that dynamic specifier has a real subpath to
    // resolve and the avatar + gsap + chat CSS stay out of every site's first paint.
    'footer/FooterChatInner': 'src/footer/FooterChatInner.tsx',
    // The concept graph. `graph/index` is the SERVER half (ConceptGraph reads
    // next/headers, LandingGraph composes it); the animated diagram is 'use client' and
    // gets its own entry so preserve-directives can't hoist a 'use client' banner over
    // the server module — the same directive-isolation boundary as themes/DbThemeApplier.
    'graph/index': 'src/graph/index.ts',
    'graph/ConceptGraphClient': 'src/graph/ConceptGraphClient.tsx',
    // The `/details/<topic>` pages: a server page + metadata builder, with the
    // filterable, arrow-key-navigable rail split out as its own 'use client' entry for
    // the same directive reason as the graph above.
    'details/index': 'src/details/index.ts',
    'details/DetailsRail': 'src/details/DetailsRail.tsx',
    // adh's theme TAXONOMY (which named areas a site's theme paints) + the Monaco CSS
    // editor. Reached by package path from debug-console so the console and the theme
    // switcher agree on one taxonomy.
    'theme-editor/index': 'src/theme-editor/index.ts',
    // adh's Debug console: the toolkit's generic console (debug-env, above) wired to
    // adh's env store + theme taxonomy. Its own entry because the site menu
    // `next/dynamic`-imports it BY PACKAGE PATH — the menu is in the always-loaded
    // header entry, so a static import would drag the taxonomy and Monaco onto every page.
    'debug-console/index': 'src/debug-console/index.tsx',
    // The marketing-site shell: root html, landing, story sections, wordmark. Three of
    // its members are separate entries — LandingHeroGate and MarketingSiteHeader are
    // 'use client' leaves imported from server modules (directive boundary again), and
    // SiteWordmark is published standalone so a site can render the mark without
    // pulling the landing page in behind it.
    'marketing/index': 'src/marketing/index.ts',
    'marketing/LandingHeroGate': 'src/marketing/LandingHeroGate.tsx',
    'marketing/SiteWordmark': 'src/marketing/SiteWordmark.tsx',
    'marketing/MarketingSiteHeader': 'src/marketing/MarketingSiteHeader.tsx',
  },
  outDir: 'dist',
  format: ['esm'],
  target: 'es2022',
  platform: 'browser',
  sourcemap: true,
  clean: true,
  dts: false,
  bundle: true,
  splitting: false,
  outExtension: () => ({ js: '.js' }),
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    'next',
    'next/headers',
    'next/navigation',
    // Subpaths, like the two above: `next` is a peerDependency, and tsup does not
    // externalize a peer's SUBPATHS from the bare name. `next/dynamic` is
    // help/HelpProvider's lazy import of the help window; `next/link` is docs/DocsShell's
    // sidebar. Inlined, esbuild would try to bundle Next itself into this dist.
    'next/dynamic',
    'next/link',
    '@agentic-toolkit/themes',
    '@agentic-toolkit/themes/manifest',
    // The auth package's token store, refresh timer, and AuthContext all live at module
    // scope. Nothing under src/ imported it before Task 6.1's auth/index entry; inlined,
    // that entry would get its own private auth instance — a user logged in through the
    // site's own toolkit-auth import would read as signed out from AppearanceSync /
    // wired-provider, in production only (dev/vitest/tsc all resolve the `development`/src
    // condition and stay green). Preserved import ⇒ one copy, resolved by the consumer.
    // Subpath listed separately, same as `@agentic-toolkit/ui/*` below: tsup's `external`
    // matches specifiers, not packages, so the bare entry does nothing for
    // '@agentic-toolkit/auth/client'.
    '@agentic-toolkit/auth',
    '@agentic-toolkit/auth/client',
    // '/ui' and '/server' aren't reached by anything under src/ yet — pre-listed the same
    // way '@agentic-toolkit/adh/flags' is above, so the day a future entry in this package
    // imports one of them it's already covered and doesn't silently get its own inlined copy.
    '@agentic-toolkit/auth/ui',
    '@agentic-toolkit/auth/server',
    '@agentic-toolkit/ui',
    // Subpath form: tsup's `external` matches SPECIFIERS, not packages, so the bare
    // entry above does nothing for '@agentic-toolkit/ui/components/badge' and friends
    // (introduced by the header modules in Task 5.6).
    '@agentic-toolkit/ui/*',
    // recents.ts holds module-level mutable state (`snapshot`, and the `listeners`
    // Set). With bundle:true/splitting:false, every entry that reaches it by a
    // RELATIVE specifier inlines its own private copy of that state — a visit
    // recorded through one entry is then invisible to a `useRecents` subscriber that
    // came in through another, silently, with no type or build error and invisible in
    // dev (next dev / vitest / tsc all resolve the `development` condition to src/).
    // Inlining it would also hoist its 'use client' directive over the whole entry.
    // Preserved import ⇒ one copy, resolved by the consumer. BOTH halves are load
    // bearing: this entry, AND every reaching specifier written as the full package
    // path '@agentic-toolkit/adh/header/recents'. One surviving './recents' defeats
    // it. Enforced by frontend/tools/verify-bundle-boundaries.py.
    '@agentic-toolkit/adh/header/recents',
    // The flags module holds the React context (FeatureFlagsProvider / FeatureFlagsContext).
    // With splitting:false, every entry that inlines it gets its OWN context instance — a consumer
    // entry in THIS package (`footer/AdhFooter`, which landed here in Task 5.7, is the nearest
    // candidate) would stop sharing state with this package's own provider (index/layout), so
    // flag-gated surfaces would read permanently OFF in production builds while dev/vitest (which
    // resolve the `development`/src condition) stayed green. Preserved import ⇒ one copy, resolved
    // by the consumer. Inert today — nothing under src/ imports ./flags yet (the one in-package
    // candidate, HierarchicalDetailViewFlag, has its flag read commented out while HMDV is parked)
    // — but load-bearing the moment one does. The same stateful-module rule, with its own
    // rationale, governs the telemetry leaves and `themes/index` in the entries immediately below.
    '@agentic-toolkit/adh/flags',
    // The telemetry leaves hold module-level mutable state (`reporter` in report-error.ts,
    // `retriedInits` in retry.ts). With splitting:false, every entry that inlines a leaf gets its
    // OWN copy of that state — TelemetryProvider's setErrorReporter (in the `telemetry` entry)
    // would write one copy while a consumer reaching the leaf through a different entry reads
    // another, whose `reporter` stays null, silently no-oping every captureException/
    // reportUnexpectedError in production builds while dev/vitest (which resolve the
    // `development`/src condition) stayed green. Preserved import ⇒ one copy, resolved by the
    // consumer. Same trick as `@agentic-toolkit/adh/flags` above.
    // NOT hypothetical since Task 5.8: `layout/RouteError.tsx` and `layout/GlobalError.tsx` —
    // whose entire job is reporting the error they render a fallback for — reach this leaf from
    // the `layout` entry, and a null `reporter` would make them fail at exactly that while still
    // rendering a correct-looking fallback. Both write the full package path; a relative
    // '../telemetry/report-error' in either one silently defeats this entry.
    '@agentic-toolkit/adh/telemetry/report-error',
    '@agentic-toolkit/adh/telemetry/retry',
    // AdhThemeStyle.tsx (server) renders DbThemeApplier ('use client'). With
    // bundle:true/splitting:false, inlining a 'use client' leaf hoists its directive to
    // the top of the WHOLE entry file — server.ts's bundle would then open with 'use
    // client', so Turbopack refuses getAdhTheme's `next/headers` import in the same
    // file ("only available in Server Components"). Preserved import ⇒ its own chunk,
    // resolved by the consumer, keeping server.js a plain server module. Same trick as
    // the two directive boundaries the app tier already had, graph/ConceptGraphClient and
    // footer/FooterChatInner — both listed in the vocabulary-tier `external` block below,
    // carried over verbatim from that tier's own tsup config when it merged in.
    '@agentic-toolkit/adh/themes/DbThemeApplier',
    // The themes barrel, reached by PACKAGE PATH from the debug console (Task 5.2's
    // `debug-env/DebugConsole.tsx` calls `useThemeEditor`, and SiteThemeBranch.tsx takes
    // its `ThemeEditorApi` type). That specifier arrived here as a genuine cross-package
    // import and became a self-reference on the way in — exactly the shape that silently
    // forks state. `useThemeEditor` drives the SAME stored themes the `./themes` entry's
    // ThemeSwitcher/DbThemeApplier read, so an inlined second copy would give the console
    // its own themes-client module: a theme saved from the console would not be visible
    // to the applier that paints the page. Preserved import ⇒ one copy, resolved by the
    // consumer. BOTH halves required — this entry, AND the package-path specifier.
    '@agentic-toolkit/adh/themes',
    // ── Task 5.5: the help surface's three preserved imports, all SELF-references ────────
    // The light Help barrel holds the React HelpContext. With splitting:false, any entry
    // that reaches it RELATIVELY inlines its own context instance — MarkdownTopic's
    // `useHelp()` (inside the help/HelpWindow entry) would then read a DIFFERENT, empty
    // context than the provider in help/index created, so clicking a cross-link in a help
    // topic would silently no-op. Same class as ./flags and ./header/recents above.
    '@agentic-toolkit/adh/help',
    // The heavy window (pre-rendered help HTML + shiki + the API browser). External so
    // HelpProvider's `next/dynamic(() => import('@agentic-toolkit/adh/help/HelpWindow'))` survives
    // into dist/help/index.js as a dynamic import the consumer's bundler code-splits, instead of
    // esbuild resolving it to the local file and evaluating the window on every page.
    '@agentic-toolkit/adh/help/HelpWindow',
    // The SSR surface's interactive rail ('use client'), reached by package path from the
    // SERVER module help/HelpSurface. Inlined, preserve-directives would hoist its 'use
    // client' over the whole help/surface entry and the help site's server component would
    // stop being one. Same shape as themes/DbThemeApplier above.
    '@agentic-toolkit/adh/help/HelpMasterDetail',
    // help/HelpWindow borrows the debug console's draggable FloatingWindow shell. That was a
    // genuine cross-package import in @adh-shared/adh and became a SELF-reference on the way
    // in — the shape that silently forks state. FloatingWindow's module-level drag geometry
    // must be ONE copy shared with the console, so preserve it rather than let the help
    // entry inline a second.
    '@agentic-toolkit/adh/debug-env',
    // help/views/ApiTopic renders the api-explorer's ApiBrowser; adh-help.css also @imports
    // that package's stylesheet + `sources.css`. A real dependency, resolved by the consuming
    // site so there is one copy of the shiki highlighter singleton and one endpoint-metadata
    // module. tsup auto-externalizes bare `dependencies`, but not reliably their subpaths, so
    // list both forms as `@agentic-toolkit/ui` does.
    '@agentic-toolkit/api-explorer',
    '@agentic-toolkit/api-explorer/*',
    // Declared as a dependency for adh-help.css's `@import "@agentic-toolkit/markdown/styles"`
    // (bare specifiers in that stylesheet resolve from THIS package) and for
    // tools/gen-help-content.py's `processMarkdown` render step. No `src/` module imports it —
    // the help corpus is PRE-rendered — but list it so a future runtime import can never be
    // inlined by accident.
    '@agentic-toolkit/markdown',
    '@agentic-toolkit/markdown/*',
    // ── Self-references from the merged adh vocabulary tier ─────────────────────────
    // Same rule as every entry above, and it applies to ALL of these without exception:
    // a package-path specifier that is NOT listed here is not a boundary — esbuild
    // resolves it and inlines the target, silently, with no build error, invisible in
    // dev/vitest/tsc (which take the `development` condition straight to src/) and wrong
    // only in production. Each line below pairs with an `entry:` above and with every
    // reaching module writing the full package path; all three halves are required.
    // `frontend/tools/verify-bundle-boundaries.py` gates the pairing.
    //
    // STATE: the taxonomy assembled at module load, plus the inlined site-config JSON.
    // Reached from graph, details, marketing — four entries that would otherwise each
    // carry their own tree and their own copy of the JSON.
    '@agentic-toolkit/adh/concepts',
    '@agentic-toolkit/adh/concepts/participating',
    // DIRECTIVE boundaries: a 'use client' leaf imported from a server module. Inlined,
    // preserve-directives hoists the leaf's banner over the whole entry and the server
    // module stops being one — the consuming site's build fails, or worse, doesn't.
    '@agentic-toolkit/adh/graph/ConceptGraphClient',
    '@agentic-toolkit/adh/details/DetailsRail',
    '@agentic-toolkit/adh/marketing/LandingHeroGate',
    '@agentic-toolkit/adh/marketing/MarketingSiteHeader',
    // LAZY boundaries: a `next/dynamic(() => import(...))` specifier. External keeps it
    // a real dynamic import in the emitted JS for the consumer's bundler to code-split;
    // inlined, esbuild resolves it to the local file and it is evaluated eagerly on
    // every page — exactly the cost the split was for.
    '@agentic-toolkit/adh/footer/FooterChatInner',
    '@agentic-toolkit/adh/debug-console',
    // The dev-only theme trio, and these three are LOAD-BEARING in a way the rest of this
    // list is not: they are what keeps the site-theme editor (Monaco included) out of every
    // production bundle. With splitting:false a relative `import('./SiteThemeConsole')` is
    // not code-split at all — esbuild inlines the module into the importing bundle behind a
    // lazy-init wrapper, so the folded gate in debug-env/DebugConsole.tsx has nothing left to
    // gate. theme-preview is here for the tree-shaking half of the same rule: as a preserved
    // import, the header bundle can drop it once the folded gate leaves it unreferenced. See
    // the chunk-gate contract in adh-registry's src/deployment-env.ts, and productionBundleGates.test.ts,
    // which checks this line against the entry, the tsconfig path and the exports map.
    '@agentic-toolkit/adh/debug-env/SiteThemeConsole',
    '@agentic-toolkit/adh/themes/theme-preview',
    // BARRELS reached across entries. `header` is also reached from WITHIN its own entry
    // (SiteHeader/SiteMenu/useSiteMenu/devToolsEntries import their own barrel); that
    // emits a self-import in dist/header/index.js, which resolves back to the module
    // already being evaluated — ESM live bindings handle it, and it is what the app tier
    // shipped before the merge. `theme-editor` and `header` both carry module state the console must share.
    '@agentic-toolkit/adh/header',
    '@agentic-toolkit/adh/header-auth',
    '@agentic-toolkit/adh/footer',
    '@agentic-toolkit/adh/layout',
    '@agentic-toolkit/adh/legal',
    '@agentic-toolkit/adh/graph',
    '@agentic-toolkit/adh/theme-editor',
    '@agentic-toolkit/adh/auth',
    '@agentic-toolkit/adh/server',
    // The telemetry BARREL (not just the two leaves above): layout/AppShell imports
    // SiteTelemetryProvider from it, and the provider's `setErrorReporter` writes the
    // same module-level `reporter` the leaves read. Inlined, AppShell would install the
    // reporter on a private copy and every captureException elsewhere would no-op.
    '@agentic-toolkit/adh/telemetry',
    // ── The two remaining adh-owned packages, now siblings in this workspace ─────────
    // The 45-site REGISTRY (ids, urls, env detection, route table). One copy, resolved
    // by the consuming site: `detectEnv`'s result and the route table must agree across
    // every entry, and the site the host builds for is the host's fact, not ours.
    // Subpaths listed separately — tsup's `external` matches specifiers, not packages.
    '@agentic-toolkit/adh-registry',
    '@agentic-toolkit/adh-registry/*',
    // bitbag: the footer chat's avatar + dock, and the theme vocabulary its `theme` prop
    // takes (re-exported by bitbag from the persona toolkit — see footer/chat-theme-store).
    // Its CSS subpath rides with the lazy FooterChatInner chunk.
    '@agentic-toolkit/bitbag',
    '@agentic-toolkit/bitbag/css/bitbag-dock.css',
    '@radix-ui/react-avatar',
    '@radix-ui/react-dropdown-menu',
    '@radix-ui/react-slot',
    'class-variance-authority',
    'clsx',
    'lucide-react',
    'tailwind-merge',
    // The landing hero's animation (marketing/LandingHeroGate) and the theme editor's
    // Monaco. Both are heavy third-party libraries the consuming site already resolves;
    // bundling them into this dist would ship a second copy per entry that touches them.
    //
    // External is NOT a production gate. This comment used to claim the editor's Monaco was
    // "tree-shaken out there", and it wasn't — Monaco shipped in a ~110 KB chunk on every
    // site until the editor got its own entry above. What keeps it out is the four-leg gate
    // in adh-registry's src/deployment-env.ts; external only decides who resolves the copy.
    'motion',
    'motion/react',
    '@monaco-editor/react',
    'monaco-editor',
  ],
  // The ONE dependency deliberately inlined. `concepts/structure.ts` and
  // `concepts/content.ts` import the authored taxonomy JSON from
  // `@agentic-toolkit/adh-site-config`; esbuild's json loader turns it into a module in
  // THIS bundle. Left external, the emitted JS would carry a bare `import ... from
  // '@agentic-toolkit/adh-site-config/structure.json'` — an import ATTRIBUTE-less JSON
  // import that Next/Turbopack resolves inconsistently across dev and prod. Inlining is
  // also why `concepts/index` must be a boundary: the JSON lands once, in that entry.
  noExternal: ['@agentic-toolkit/adh-site-config'],
  esbuildPlugins: [
    preserveDirectivesPlugin({
      directives: ['use client', 'use server'],
      include: /\.(js|ts|jsx|tsx)$/,
      exclude: /node_modules/,
    }),
  ],
})
