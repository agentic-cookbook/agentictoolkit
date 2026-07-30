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
import { AdhAppShell } from '@agentic-toolkit/adh/layout'

// Build-time gate for the dev-only switches (same allowlist as devToolsEntries'
// DEV_TOOLS_BUILD_ENABLED): the env var is inlined per build, so a production build folds this
// to `false` and AdhAppShell's `devTools` mounts nothing — which is what keeps the debug
// switches out of "all environments other than prod". (Unlike the site menu's dev tail, this
// has no signed-in-admin unlock — it stays build-gated.) Spelled out here rather than shared,
// deliberately: a cross-module const would defeat that inlining. An explicit allowlist (not
// `!== 'production'`) keeps an unset/unknown env fail-safe.
//
// It stays on THIS side of the toolkit boundary: `NEXT_PUBLIC_DEPLOYMENT_ENV` is adh's env var,
// so AdhAppShell takes the already-folded boolean as a prop instead of reading it.
//
// KNOW WHAT THAT COSTS — the dead-code elimination is NOT identical any more. Pre-split, the env
// read and the switch components lived in one module, so a production build dropped the
// components outright. Now they sit behind a package boundary and the toolkit's `layout` entry
// imports them unconditionally; no bundler can propagate this folded `false` back through that
// import. So `DevAnimScale` and `HtdvLayoutLogSwitch` SHIP in the production client bundle and
// this constant only stops them MOUNTING. Bytes, not behaviour — and the accepted price of
// keeping adh's deployment vocabulary out of a generic package. See the `devTools` prop doc on
// AdhAppShell for the same note from the other side.
const DEV_TOOLS_BUILD_ENABLED =
  process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === 'local' ||
  process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === 'testing' ||
  process.env.NEXT_PUBLIC_DEPLOYMENT_ENV === 'staging'

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
          <AdhAppShell
            header={header}
            footer={<SiteFooter links={footer?.links} />}
            devTools={DEV_TOOLS_BUILD_ENABLED}
          >
            {children}
          </AdhAppShell>
        </TelemetryProvider>
      </HelpProvider>
    </FeatureFlagsProvider>
  )
}
