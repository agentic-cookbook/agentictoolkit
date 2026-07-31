'use client'

import { useEffect, useState, useSyncExternalStore, type ReactElement } from 'react'
import { Moon, RefreshCw, Sun } from 'lucide-react'
import type { ColorModePref } from '@agentic-toolkit/themes'
// PACKAGE PATH, not '../auth' — `src/auth/index.ts` is its own tsup entry and is listed
// in this package's `external`. A relative specifier would inline a private copy of that
// entry into the header bundle, and with it a second `useAppearanceSettings` writing
// through a second import of the appearance store: a mode set from this button would be
// invisible to AppearanceSync and the settings panel. Production only — dev, vitest and
// tsc all resolve the `development` condition straight to src/ and stay green.
import { useAppearanceSettings } from '@agentic-toolkit/adh/auth'

/**
 * The light / dark / auto control, for any site's header actions row.
 *
 * It writes the ONE appearance store — the same `colorMode` the settings panel edits and
 * the pre-paint script reads — so a flip here is saved to the signed-in user's account
 * and follows them to every other site in the family. It was the cookbook's own
 * `ThemeContext` + a button in `CookbookChrome`; nothing in it was ever cookbook-specific,
 * and a second site wanting the control would have had to copy it.
 *
 * Not to be confused with `@agentic-toolkit/controls`' `AppearanceModeToggle`, which drives
 * a different mechanism entirely (`data-appearance-mode` + `awt:appearance-cycle` events)
 * for the toolkit's own demo site. Same picture, unrelated plumbing.
 *
 * Everything visual is CSS (`.adh-color-mode-toggle__*`): which face shows, and whether the
 * auto badge shows, are both decided from attributes the pre-paint script has already put
 * on `<html>`, so they are right in the first painted frame rather than a frame after
 * hydration. See adh-components.css. The one thing that cannot be is the accessible NAME —
 * hence `mounted` below.
 */

const CYCLE: readonly ColorModePref[] = ['auto', 'dark', 'light']

const SYSTEM_DARK_QUERY = '(prefers-color-scheme: dark)'

/**
 * `prefers-color-scheme` as an external store, which is what it is: a mutable source
 * outside React that this component subscribes to. Read with `useSyncExternalStore` so the
 * first render already has the right value, rather than rendering wrong and correcting in
 * an effect — and so the OS-flip listener comes along with the subscription.
 *
 * It resolves the LABEL only. What the page is actually painted in comes from the `dark`
 * class the appearance store maintains; nothing here touches the document.
 */
function subscribeSystemDark(onStoreChange: () => void): () => void {
  const mq =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(SYSTEM_DARK_QUERY)
      : null
  // Probed, not assumed — Safari < 14 shipped MediaQueryList with only the legacy
  // `addListener`, and the appearance store probes for the same reason.
  if (typeof mq?.addEventListener !== 'function') return () => {}
  mq.addEventListener('change', onStoreChange)
  return () => mq.removeEventListener('change', onStoreChange)
}

function getSystemDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia(SYSTEM_DARK_QUERY).matches
}

/** No OS to ask on the server. */
function getServerSystemDark(): boolean {
  return false
}

function title(mode: ColorModePref, resolved: 'light' | 'dark'): string {
  if (mode === 'auto') return `Following system (${resolved})`
  return mode === 'dark' ? 'Dark mode — click for light' : 'Light mode — click for auto'
}

export function ColorModeToggle(): ReactElement {
  const { prefs, set } = useAppearanceSettings()
  const systemDark = useSyncExternalStore(
    subscribeSystemDark,
    getSystemDark,
    getServerSystemDark,
  )

  // The accessible name is client-only twice over: the saved mode comes from localStorage
  // and the resolved theme from matchMedia, and neither exists when this HTML is generated,
  // so neither may appear in it.
  //
  // The gate has to live in THIS component — the one React hydrates — not in a provider
  // above it. A host's header commonly hydrates inside a `<Suspense>` boundary that a
  // provider sits outside of, so by the time this subtree hydrates the provider has long
  // since published the real values, and the subtree hydrates against them while its server
  // HTML says otherwise. `mounted` is created here, so it is `false` on both sides no matter
  // when that happens; the real label arrives in the ordinary render right after.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const mode = prefs.colorMode
  const resolved: 'light' | 'dark' = mode === 'auto' ? (systemDark ? 'dark' : 'light') : mode
  const next = CYCLE[(CYCLE.indexOf(mode) + 1) % CYCLE.length]

  return (
    // adh-ui-allow: cs-no-bespoke — an icon control in the header's actions row, wearing
    // the header's own `.adh-header__icon-button` identity. A ui <Button> brings a labelled
    // button's identity (full text colour, hover fill), which is exactly what must NOT
    // happen to a quiet glyph in this row — the same call AuthButtons.tsx makes for a nav
    // link. The identity itself is shared CSS, not markup invented here.
    <button
      type="button"
      onClick={() => set({ colorMode: next })}
      className="adh-header__icon-button adh-color-mode-toggle"
      aria-label={
        mounted
          ? `Theme: ${mode === 'auto' ? `Auto (currently ${resolved})` : mode}. Click to switch to ${next}.`
          : 'Theme'
      }
      title={mounted ? title(mode, resolved) : undefined}
    >
      <Moon className="adh-color-mode-toggle__moon" strokeWidth={2} />
      <Sun className="adh-color-mode-toggle__sun" strokeWidth={2} />
      <RefreshCw className="adh-color-mode-toggle__badge" strokeWidth={3} />
    </button>
  )
}
