"use client"

import { useEffect, useState, useSyncExternalStore, type ReactElement } from "react"
import { Moon, RefreshCw, Sun } from "lucide-react"

import { cn } from "../lib/utils"

/**
 * The light / dark / auto control — one button that cycles the three modes.
 *
 * It is a CONTROL, not a store: `mode` comes in and `onChange` goes out, so it belongs
 * to whoever owns colour mode on that host. It was the cookbook's own button over a
 * local `ThemeContext`, then briefly `@agentic-toolkit/adh/header`'s — neither was ever
 * right. Nothing about a light/dark button is adh-specific, and it is not header
 * furniture either: a settings panel or a toolbar can draw it just as well.
 *
 * An adh host wires it to the family's one appearance store, so a flip is saved to the
 * signed-in user's account and follows them to every other site:
 *
 * ```tsx
 * const { prefs, set } = useAppearanceSettings() // @agentic-toolkit/adh/auth
 * <ColorModeToggle
 *   mode={prefs.colorMode}
 *   onChange={(colorMode) => set({ colorMode })}
 *   className="adh-header__icon-button"
 * />
 * ```
 *
 * Anywhere else, `useAppearancePreferences()` (@agentic-toolkit/themes) is the same
 * shape without the account leg.
 *
 * Not to be confused with `@agentic-toolkit/controls`' `AppearanceModeToggle`, which
 * binds the LEGACY appearance system (`data-appearance-mode` + `awt:appearance-cycle`,
 * see themes/src/colorMode.tsx) for the toolkit's own demo site. Same picture, and it
 * stays separate until that site migrates — merging them would change a live site's
 * document contract, not just its markup.
 *
 * Everything visual is CSS (`.adh-color-mode-toggle__*` in styles/components.css): which
 * face shows, and whether the auto badge shows, are both decided from attributes the
 * appearance pre-paint script has already put on `<html>`, so they are right in the
 * first painted frame rather than a frame after hydration. The one thing that cannot
 * be is the accessible NAME — hence `mounted` below.
 */

export type ColorMode = "auto" | "light" | "dark"

export interface ColorModeToggleProps {
  /** The saved preference. `auto` means "follow the OS". */
  mode: ColorMode
  /** Called with the next mode in the cycle when the button is pressed. */
  onChange: (next: ColorMode) => void
  /** The host's own button identity — adh chrome passes `adh-header__icon-button`. */
  className?: string
}

/** The cycle: auto → dark → light → auto. As a map rather than an array walked with
 *  modular arithmetic, so every mode's successor is total and stated. */
const NEXT_MODE: Readonly<Record<ColorMode, ColorMode>> = {
  auto: "dark",
  dark: "light",
  light: "auto",
}

const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)"

/**
 * `prefers-color-scheme` as an external store, which is what it is: a mutable source
 * outside React that this component subscribes to. Read with `useSyncExternalStore` so the
 * first render already has the right value, rather than rendering wrong and correcting in
 * an effect — and so the OS-flip listener comes along with the subscription.
 *
 * It resolves the LABEL only. What the page is actually painted in comes from the `dark`
 * class the host's appearance system maintains; nothing here touches the document.
 */
function subscribeSystemDark(onStoreChange: () => void): () => void {
  const mq =
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(SYSTEM_DARK_QUERY)
      : null
  // Probed, not assumed — Safari < 14 shipped MediaQueryList with only the legacy
  // `addListener`, and the appearance store probes for the same reason.
  if (typeof mq?.addEventListener !== "function") return () => {}
  mq.addEventListener("change", onStoreChange)
  return () => mq.removeEventListener("change", onStoreChange)
}

function getSystemDark(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false
  return window.matchMedia(SYSTEM_DARK_QUERY).matches
}

/** No OS to ask on the server. */
function getServerSystemDark(): boolean {
  return false
}

function title(mode: ColorMode, resolved: "light" | "dark"): string {
  if (mode === "auto") return `Following system (${resolved})`
  return mode === "dark" ? "Dark mode — click for light" : "Light mode — click for auto"
}

export function ColorModeToggle({
  mode,
  onChange,
  className,
}: ColorModeToggleProps): ReactElement {
  const systemDark = useSyncExternalStore(subscribeSystemDark, getSystemDark, getServerSystemDark)

  // The accessible name is client-only twice over: the saved mode comes from the host's
  // store (localStorage, on adh) and the resolved theme from matchMedia, and neither
  // exists when this HTML is generated, so neither may appear in it.
  //
  // The gate has to live in THIS component — the one React hydrates — not in a provider
  // above it. A host's header commonly hydrates inside a `<Suspense>` boundary that a
  // provider sits outside of, so by the time this subtree hydrates the provider has long
  // since published the real values, and the subtree hydrates against them while its server
  // HTML says otherwise. `mounted` is created here, so it is `false` on both sides no matter
  // when that happens; the real label arrives in the ordinary render right after.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const resolved: "light" | "dark" = mode === "auto" ? (systemDark ? "dark" : "light") : mode
  const next = NEXT_MODE[mode]

  return (
    // adh-ui-allow: cs-no-bespoke — a quiet icon control that takes its identity from the
    // host (`className`). A <Button> brings a labelled button's identity (full text colour,
    // hover fill), which is exactly what must NOT happen to a glyph in a header actions row.
    <button
      type="button"
      onClick={() => onChange(next)}
      className={cn("adh-color-mode-toggle", className)}
      aria-label={
        mounted
          ? `Theme: ${mode === "auto" ? `Auto (currently ${resolved})` : mode}. Click to switch to ${next}.`
          : "Theme"
      }
      title={mounted ? title(mode, resolved) : undefined}
    >
      <Moon className="adh-color-mode-toggle__moon" strokeWidth={2} />
      <Sun className="adh-color-mode-toggle__sun" strokeWidth={2} />
      <RefreshCw className="adh-color-mode-toggle__badge" strokeWidth={3} />
    </button>
  )
}
