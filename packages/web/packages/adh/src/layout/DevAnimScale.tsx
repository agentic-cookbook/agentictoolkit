'use client'

import { useEffect } from 'react'
import { useSlowAnimations, slowAnimationVars } from '@agenticdevelopertoolkit/ui/blocks'

/**
 * Applies the dev-only 10x-slow animation scale to the DOCUMENT ROOT. Renders nothing.
 *
 * Root, not a container, because that's the only element that reaches everything: dialogs, popovers
 * and menus render through a PORTAL into `document.body`, so they are outside every React subtree
 * but inside `<html>`. It also has to be `<html>` to win — Tailwind defines
 * `--default-transition-duration` on `:root`, and an inline style there beats the stylesheet rule
 * while still inheriting. See `slowAnimationVars` for what the two variables cover.
 *
 * Mounted from {@link AdhAppShell} rather than the Debug console, because the flag has to keep applying
 * after the console is closed — and the console is where you turn it on.
 */
export function DevAnimScale(): null {
  const slow = useSlowAnimations()
  useEffect(() => {
    if (!slow) return
    // Applied only while ON, and removed (not reset to an "off" value) when it goes off or this
    // unmounts: both variables have a resting definition to fall back to, so absence is the off
    // state — see `slowAnimationVars`.
    const root = document.documentElement
    const vars = slowAnimationVars()
    for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value)
    return () => {
      for (const name of Object.keys(vars)) root.style.removeProperty(name)
    }
  }, [slow])
  return null
}
