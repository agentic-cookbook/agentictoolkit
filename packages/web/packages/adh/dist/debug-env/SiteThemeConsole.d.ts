import type { TopicLevel } from '@agenticdevelopertoolkit/ui/blocks';
import type { ThemeAreasLoader } from './seams';
/**
 * A mutable slot through which the mounted topic lends its unsaved-changes guard to the
 * Debug console body. The body owns the two transitions that can destroy a draft — moving
 * to another topic, and closing the window — but the draft itself belongs to the topic, so
 * the topic publishes `(run) => …` here and the body routes both transitions through it.
 * `null` means "nothing to guard, run immediately".
 */
export type LeaveGuardRef = {
    current: ((run: () => void) => void) | null;
};
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
export declare function SiteThemeConsole({ rootLevel, leaveRef, themeAreas, }: {
    rootLevel: TopicLevel;
    leaveRef: LeaveGuardRef;
    /** Loads the host's theme taxonomy + CSS editor — see {@link ThemeAreasLoader} for why
     *  this is a loader and not the surface itself. */
    themeAreas: ThemeAreasLoader;
}): import("react").JSX.Element | null;
//# sourceMappingURL=SiteThemeConsole.d.ts.map