'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'

// The header's centre as a PORTAL TARGET, so a route below the shell can put something there.
//
// AdhHeader already renders an absolutely-centred `.adh-header__center` fed by a `center` prop,
// but that prop is unreachable from a page: the header is built by the site's root layout and
// composed into AppShell ABOVE the route, so a route cannot hand it a node. This publishes the
// element instead, and the route portals into it.
//
// Why a portal rather than teaching the header about its content: the header ships on every page
// of every site, including fully public landing pages. It depends on neither
// @agentic-toolkit/data nor any workspace vocabulary, and this keeps it that way — the /home
// picker's React tree lives under HomeGate, so its bytes stay out of the public bundle.
//
// MODULE STATE. `HeaderCenterContext` is created at module scope, so this file is its OWN tsup
// entry (`header/HeaderCenter`), listed in `external`, and every reaching specifier is the full
// package path '@agentic-toolkit/adh/header/HeaderCenter'. With bundle:true/splitting:false a
// RELATIVE import would inline a second context into the reaching entry's bundle — the provider
// (mounted from the `layout` entry) and the consumer (from the `home` entry) would silently stop
// sharing one, in production only: dev, vitest and tsc all resolve the `development` condition
// to src/ and stay green. Same rule as ./flags and ./header/recents; see tsup.config.ts.
//
// frontend/tools/verify-bundle-boundaries.py's Check B gates this, but only since the branch that
// added this file: its `has_module_state` predicate modelled state as MUTATION (a top-level
// `let`/`var`, or a `const` bound to a new Map/Set/WeakMap/WeakSet) and a `createContext` call
// matched none of those, so the module was skipped outright and the sentence you are reading was
// false. A `createContext` clause was added there, with a fixture built from THIS declaration.
// Verified by mutation, not by reading: rewriting the import in ./../home/SiteHomeShell.tsx to a
// relative specifier and rebuilding @agentic-toolkit/adh makes the guard report
// `CHECK B src/header/HeaderCenter.tsx ... inlined separately into
// ['dist/header/HeaderCenter.js', 'dist/home/index.js']` and exit 1.

interface HeaderCenterValue {
  el: HTMLElement | null
  register: (el: HTMLElement | null) => void
  /** Whether a HeaderCenterProvider is mounted above the calling component. `false` only for the
   *  module-scope default — i.e. there is no provider at all; a mounted provider with no element
   *  registered yet (the pre-hydration window) is still `true`. */
  provided: boolean
}

// No provider ⇒ nothing to portal into and nothing to register. A bare AdhHeader (the status
// site renders its own) must still work, so the default is inert rather than a throw.
const NOOP = (): void => {}

const HeaderCenterContext = createContext<HeaderCenterValue>({
  el: null,
  register: NOOP,
  provided: false,
})

/** Publishes the header's centre element to everything it wraps. Mounted by AdhAppShell so it
 *  covers the header AND the page — a provider around the page alone would never see the div. */
export function HeaderCenterProvider({ children }: { children: ReactNode }): ReactElement {
  const [el, setEl] = useState<HTMLElement | null>(null)
  // Stable: React re-runs a ref callback whose identity changed (null, then the node), so an
  // inline arrow here would detach and re-attach the slot on every render of the provider.
  const register = useCallback((next: HTMLElement | null) => setEl(next), [])
  const value = useMemo(() => ({ el, register, provided: true }), [el, register])
  return <HeaderCenterContext.Provider value={value}>{children}</HeaderCenterContext.Provider>
}

/** The header's centre element, or null — before mount, on the server, or with no provider. */
export function useHeaderCenter(): HTMLElement | null {
  return useContext(HeaderCenterContext).el
}

/** The ref callback AdhHeader hands its centre div. */
export function useHeaderCenterRegister(): (el: HTMLElement | null) => void {
  return useContext(HeaderCenterContext).register
}

/** Whether a HeaderCenterProvider is mounted above the calling component. See SiteHomeShell,
 *  which warns (dev-only) when it renders with no provider above it — the desktop chooser has
 *  nowhere to portal into and silently disappears above 768px. */
export function useHeaderCenterProvided(): boolean {
  return useContext(HeaderCenterContext).provided
}
