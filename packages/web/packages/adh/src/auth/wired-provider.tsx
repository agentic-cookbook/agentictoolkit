'use client'

import { useState, type ReactElement } from 'react'
// Package path, not relative: this package bundles with tsup `bundle: true,
// splitting: false`, and `src/auth/index.ts` is its own tsup entry. A relative
// '../telemetry/report-error' or '../telemetry/retry' here would inline a SECOND,
// private copy of each leaf's module-level state into the `auth` entry — the
// `reporter` TelemetryProvider wires (in the `telemetry` entry) and the
// `retriedInits` WeakSet the http client tags would both be invisible from here.
// Same class as layout/RouteError.tsx + layout/GlobalError.tsx; matching `external`
// entries required (see tsup.config.ts).
import { captureException } from '@agentic-toolkit/adh/telemetry/report-error'
import { markRetriedRequest } from '@agentic-toolkit/adh/telemetry/retry'
import {
  AuthProvider as ToolkitAuthProvider,
  setAuthErrorReporter,
  setAuthRetryMarker,
  type AuthProviderProps,
  type AuthUser,
} from '@agentic-toolkit/auth'
import { AppearanceSync } from './AppearanceSync'

// The one adh-specific piece of the AuthProvider: bridge the toolkit's
// host seams into the adh telemetry pipeline. Every adh app mounts AuthProvider
// through this shim (directly or via MarketingRootHtml), so wiring here keeps
// GlitchTip capture + retried-request tagging alive for all of them with zero
// per-site edits. Wired lazily inside the component (not at module scope) so a
// bundler that skips side-effect-free re-export modules can never drop it.
//
// Module-level one-shot guard: safe as written today (this file is reached only
// through this package's own src/auth/index.ts, a single tsup entry, so there is
// exactly one `wired`). But this package bundles with splitting: false — if a
// FUTURE consumer reaches this file by a RELATIVE specifier from a DIFFERENT tsup
// entry (Task 6.3 moves MarketingRootHtml into this package, and it renders this
// provider), that entry inlines its OWN private copy of `wired`, and the wiring
// silently re-runs — or worse, setAuthErrorReporter/setAuthRetryMarker get called
// against a forked telemetry module instance. Task 6.3: reach this via the package
// path '@agentic-toolkit/adh/auth', not a relative import, or add this entry to the
// preserved-import `external` list the same way the telemetry leaves are.
let wired = false
function wireAdhTelemetry(): null {
  if (!wired) {
    wired = true
    setAuthErrorReporter(captureException)
    setAuthRetryMarker(markRetriedRequest)
  }
  return null
}

/** The toolkit AuthProvider with adh telemetry pre-wired (see above), plus the appearance sync. */
export function AuthProvider<U extends AuthUser = AuthUser>(
  props: AuthProviderProps<U>,
): ReactElement {
  // Synchronous, before any child effect can call authedJson/refresh — the same
  // once-per-mount pattern the provider itself uses for configureAuth.
  useState(wireAdhTelemetry)
  // AppearanceSync goes HERE, inside the provider, for the same reason the telemetry wiring does:
  // this shim is the one component every adh app mounts (directly or via MarketingRootHtml), so a
  // cross-cutting concern placed here reaches all of them with no per-site edit — and it needs
  // `useAuth()`, which only resolves below the provider. It renders nothing.
  return (
    <ToolkitAuthProvider {...props}>
      <AppearanceSync />
      {props.children}
    </ToolkitAuthProvider>
  )
}
