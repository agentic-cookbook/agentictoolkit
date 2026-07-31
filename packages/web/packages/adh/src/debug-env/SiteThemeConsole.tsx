'use client'

import { useEffect, useState } from 'react'
import type { TopicLevel } from '@agentic-toolkit/ui/blocks'
import { HierarchicalDetailView } from '@agentic-toolkit/ui/blocks'
// Package path, not '../themes/useThemeEditor': the editor state is a stateful module and
// `@agentic-toolkit/adh/themes` is listed `external`, so it stays one shared copy instead of
// being inlined into this entry — SiteThemeBranch takes its `ThemeEditorApi` type from the
// same specifier.
import { useThemeEditor } from '@agentic-toolkit/adh/themes'
import { useSiteThemeBranch } from './SiteThemeBranch'
import type { ThemeAreasLoader, ThemeAreasSurface } from './seams'

/**
 * A mutable slot through which the mounted topic lends its unsaved-changes guard to the
 * Debug console body. The body owns the two transitions that can destroy a draft — moving
 * to another topic, and closing the window — but the draft itself belongs to the topic, so
 * the topic publishes `(run) => …` here and the body routes both transitions through it.
 * `null` means "nothing to guard, run immediately".
 */
export type LeaveGuardRef = { current: ((run: () => void) => void) | null }

/**
 * The Debug console's "Site theme" topic, as a SELF-CONTAINED component that renders its own
 * HierarchicalDetailView.
 *
 * It is a component (not the `useSiteThemeBranch` hook called inline in the console body)
 * for one reason: a hook cannot be behind a dynamic `import()`, and the whole point is that
 * production never loads this code. The editor state (useThemeEditor) and the
 * theme-persistence client hang off this module, so keeping the module out of production's
 * graph keeps both out. The console body imports it through the env-gated `next/dynamic` in
 * {@link DebugConsoleBody}.
 *
 * The host's half — its taxonomy and CSS editor, which for adh means Monaco — cannot hang
 * off this module, because it is the HOST's code. It arrives through a loader the host has
 * gated the same way; see {@link ThemeAreasLoader}.
 *
 * Because the draft state lives here, the body's topic-change and window-close have to ask
 * before unmounting it — hence `leaveRef` (see {@link LeaveGuardRef}).
 */
export function SiteThemeConsole({
  rootLevel,
  leaveRef,
  themeAreas,
}: {
  rootLevel: TopicLevel
  leaveRef: LeaveGuardRef
  /** Loads the host's theme taxonomy + CSS editor — see {@link ThemeAreasLoader} for why
   *  this is a loader and not the surface itself. */
  themeAreas: ThemeAreasLoader
}) {
  // Resolved HERE rather than by the console body, so the host's `import()` stays behind
  // this module — which production never loads. The body would have had to hold the
  // surface to pass it down, and holding it means asking for it in every env.
  const [surface, setSurface] = useState<ThemeAreasSurface | null>(null)
  useEffect(() => {
    let live = true
    void themeAreas().then((s) => {
      if (live) setSurface(s)
    })
    return () => {
      live = false
    }
  }, [themeAreas])

  // One frame of nothing while the host's chunk arrives. No placeholder: the console body
  // already swapped to this pane, so a spinner here would be the second one in a row.
  if (!surface) return null
  return <SiteThemeBody rootLevel={rootLevel} leaveRef={leaveRef} themeAreas={surface} />
}

/** The topic proper, mounted once the surface exists — split out because `useSiteThemeBranch`
 *  is a hook and so cannot be called on the branch where the surface is still loading. */
function SiteThemeBody({
  rootLevel,
  leaveRef,
  themeAreas,
}: {
  rootLevel: TopicLevel
  leaveRef: LeaveGuardRef
  themeAreas: ThemeAreasSurface
}) {
  const ed = useThemeEditor()
  const site = useSiteThemeBranch(ed, themeAreas)

  // Lend the guard upward only while there is something to lose, and withdraw it on
  // unmount — a stale guard left behind after switching topics would prompt about a
  // draft that no longer exists (and hold a reference to an unmounted branch).
  useEffect(() => {
    leaveRef.current = ed.dirty ? site.guardLeave : null
    return () => {
      leaveRef.current = null
    }
  }, [ed.dirty, site, leaveRef])

  return (
    <>
      <HierarchicalDetailView
        levels={[rootLevel, ...site.levels]}
        rootLabel="Debug Options"
        disclosureStyle="cascading"
        exitGuard={null}
      >
        {site.leaf}
      </HierarchicalDetailView>
      {site.prompt}
    </>
  )
}
