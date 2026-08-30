import type { ReactNode } from 'react'
// Package paths, never relative ones. Every specifier below reaches a module that holds
// module-level state (a React context, or an SDK-init side effect that must run once), and
// this package builds with tsup at `bundle: true, splitting: false` — a relative specifier
// would be INLINED, giving this entry a private copy of that state that the rest of the app
// never sees. The other half of the remedy is the matching entry in the `external` array of
// this package's tsup.config.ts (and, for the toolkit specifiers, of the toolkit's).
import { SiteFooter, type FooterLink } from '@agentic-toolkit/adh/footer'
import { SiteTelemetryProvider as TelemetryProvider } from '@agentic-toolkit/adh/telemetry'
import { FeatureFlagsProvider } from '@agentic-toolkit/adh/flags'
import { HelpProvider } from '@agentic-toolkit/adh/help'
// The shared User Settings overlay (Task 8). Package path, not './settings/settings-overlay'
// — see the matching `external` entry in tsup.config.ts for why a relative one here would
// fork SettingsOverlayContext from the copy SiteHeader.tsx's useSettingsOverlay() reads.
import { SettingsOverlayProvider } from '@agentic-toolkit/adh/settings'
import { AdhAppShell } from '@agentic-toolkit/adh/layout'
// Its OWN subpath — not `./server`, and not a relative import. The module behind it imports
// `node:fs` and `node:child_process`, and this file lives in the `./layout` barrel, which
// `'use client'` code imports (every site's app/global-error.tsx pulls `GlobalError` from
// it). Reaching the builtins through `./server` was thought to be enough because the emitted
// specifier stays external — but external is not absent: the consumer's bundler follows the
// edge, and Turbopack walked it into `Can't resolve 'child_process' / 'fs'` on every site.
// `./live-build-identity` exists so the subpath can carry a `browser` condition, which sends
// a client graph to a stub and keeps the builtins on the server side of the resolver. See
// live-build-identity-browser.ts.
//
// This component is a Server Component (sync, hook-free — see the doc below), so it is the
// one seam that can resolve a per-render value and hand it to the client footer as a prop,
// giving all 45 sites an honest dev-mode footer with no per-site plumbing. Returns
// `undefined` outside development.
import { liveBuildIdentity } from '@agentic-toolkit/adh/live-build-identity'
// Same rule, different package: deployment-env lives in adh-registry (the leaf this package
// depends on) so that the registry's own seo/metadata.ts can read the identical allowlist
// without a cycle. `@agentic-toolkit/adh-registry/*` is in tsup's `external` too, so the
// specifier stays bare in this dist — see the const below, and the chunk-gate contract at the
// top of that module.
import { DEV_BUILD } from '@agentic-toolkit/adh-registry/deployment-env'

// Build-time gate for the dev-only switches (same gate as devToolsEntries'
// DEV_TOOLS_BUILD_ENABLED): the env var is inlined per build, so a production build folds this
// to `false` and AdhAppShell's `devTools` mounts nothing — which is what keeps the debug
// switches out of "all environments other than prod". (Unlike the site menu's dev tail, this
// has no signed-in-admin unlock — it stays build-gated.)
//
// This used to re-spell the allowlist locally, on the stated theory that "a cross-module const
// would defeat that inlining". It doesn't, and that was worth measuring rather than assuming:
// when deployment-env was bundled INTO this dist, the `process.env` comparisons landed in this
// same module for Next to fold and scope hoisting propagated the result across the const — two
// production builds of a consuming site, one with the old inline expression and one with this
// import, came out byte-identical (307 chunks, 16,690,775 bytes, the same content-hashed
// names). Read that as "a shared const does not defeat the fold", which is the claim being
// made; the byte-for-byte figure was measured before deployment-env moved out to adh-registry
// and one module boundary now sits between the comparisons and this const.
//
// The gate holds across that boundary regardless: `NEXT_PUBLIC_*` is substituted by Next in
// every module it processes, node_modules included, so the comparisons still fold to a literal
// wherever they live and a folded `false` still reaches DEV_TOOLS_BUILD_ENABLED.
//
// That measurement is about a MOUNT, not a chunk: it is why a shared const is fine here, and
// NOT a licence to gate a dynamic import on one — see the chunk-gate contract in
// `@agentic-toolkit/adh-registry/deployment-env` for the case where the identifier does defeat
// the fold.
//
// The read stays on THIS side of the AdhAppShell boundary: `NEXT_PUBLIC_DEPLOYMENT_ENV` is adh's
// env var, so AdhAppShell takes the already-folded boolean as a prop instead of reading it.
//
// KNOW WHAT THAT COSTS — the dead-code elimination is NOT identical any more. Pre-split, the env
// read and the switch components lived in one module, so a production build dropped the
// components outright. Now they sit behind AdhAppShell, whose `layout` entry imports them
// unconditionally; no bundler can propagate this folded `false` back through that import. So
// `DevAnimScale` and `HtdvLayoutLogSwitch` SHIP in the production client bundle and this
// constant only stops them MOUNTING. Bytes, not behaviour — and the accepted price of keeping
// adh's deployment vocabulary out of a generic shell. See the `devTools` prop doc on
// AdhAppShell for the same note from the other side.
const DEV_TOOLS_BUILD_ENABLED = DEV_BUILD

export type AppShellProps = {
  /** The site header (e.g. <AdhHeader siteId=… />), supplied by the site so it
   *  can wire in its own auth/user. */
  header: ReactNode
  children: ReactNode
  /** Extra footer links; the copyright is a fixed brand line owned by the shared
   *  footer (not per-site). */
  footer?: { links?: FooterLink[] }
}

/**
 * The shared page shell every adh site renders: header, a flex-growing main region, and the
 * shared footer, with adh's cross-cutting providers mounted around it. Call-site signature is
 * unchanged from the pre-split husk's AppShell.
 *
 * The layout MECHANISM is `AdhAppShell` in `@agentic-toolkit/adh/layout`; this component is the
 * adh-specific composition root — which providers wrap the shell, and what goes in its footer
 * slot. Stays hook-free itself (server-renderable); the providers are client children.
 */
export function AppShell({ header, children, footer }: AppShellProps) {
  return (
    // FeatureFlagsProvider wraps the WHOLE shell, not just the page: the header/landing are
    // consumers, and a site's own pages read the same one flag set rather than fetching it a
    // second time.
    <FeatureFlagsProvider>
      {/* Wraps the header too, so the header's Help trigger and the modal share one context.
          NOTE: pre-split, HelpProvider sat INSIDE HierarchicalDetailViewFlag; HDVF now lives
          inside AdhAppShell, so the two swapped. The help modal's own HierarchicalDetailView
          (HelpWindow.tsx) is therefore no longer under the flag provider and falls back to
          MenuDetailViewContext's `createContext(false)` default — which is the same `false`
          HierarchicalDetailViewFlag hard-codes today (`menuDetail={false}`, HMDV parked), so
          the rendered result is byte-identical. See the note at the re-arm site in
          HierarchicalDetailViewFlag.tsx: whoever re-arms HMDV must re-nest these two. */}
      <HelpProvider>
        {/* Pre-split this sat INSIDE <main>, wrapping only the page. It is a side-effect
            provider (Sentry + PostHog init and fetch instrumentation — it publishes no React
            context, so nothing can lose a consumer by moving), and hoisting it above the shell
            means the SDK is initialised before the header, the footer, or AppErrorBoundary can
            produce anything to report. Strictly more coverage, same behaviour. */}
        <TelemetryProvider>
          {/* Wraps the header too, so the avatar menu's User Settings row and the dialog
              it opens share one context — the same reason HelpProvider sits where it does.
              Mounted here rather than per-site so all 45 header-bearing sites inherit the
              PROVIDER from one seam (Task 8). The ROW appears on 44 of them: `status`
              renders <SiteHeader siteId="status"/> without a `useAuthSource`, so its header
              takes the default `useAnonymousHeaderAuth` and reports no user — this is a
              header-wiring fact, not an auth one; status/app/providers.tsx does mount a real
              adh AuthProvider. Mounting here is safe either way: SettingsOverlayProvider
              renders its (lazily-loaded) dialog body only while open, and SiteHeader never
              calls openSettings for a signed-out visitor. */}
          <SettingsOverlayProvider>
            <AdhAppShell
              header={header}
              footer={<SiteFooter links={footer?.links} live={liveBuildIdentity()} />}
              devTools={DEV_TOOLS_BUILD_ENABLED}
            >
              {children}
            </AdhAppShell>
          </SettingsOverlayProvider>
        </TelemetryProvider>
      </HelpProvider>
    </FeatureFlagsProvider>
  )
}
