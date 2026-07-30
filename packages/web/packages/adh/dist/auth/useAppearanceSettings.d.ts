import { type AppearancePrefs } from '@agentic-toolkit/themes';
export interface UseAppearanceSettings {
    prefs: AppearancePrefs;
    /** Apply a change: live on this document immediately, and saved to the user's account. */
    set: (patch: Partial<AppearancePrefs>) => void;
}
/**
 * The appearance preferences as a SETTING — the editing counterpart to {@link AppearanceSync}.
 *
 * The toolkit's `useAppearancePreferences` is deliberately transport-agnostic: it owns the prefs,
 * the document, and the per-browser cache, and knows nothing about adh's backend. This hook adds
 * the one adh-specific half — persisting to the signed-in USER (PUT /api/me/appearance), which is
 * what lets the choice made here follow them to the other ~44 sites instead of dying in this
 * origin's localStorage.
 *
 * Optimistic by design: the document updates on the click, and the save rides behind it. A failed
 * save is reported but not rolled back — yanking the theme back mid-interaction is worse than a
 * setting that is right here and re-syncs on the next load.
 *
 * Signed out, it degrades to the local-only behaviour (there is no account to save to).
 */
export declare function useAppearanceSettings(): UseAppearanceSettings;
//# sourceMappingURL=useAppearanceSettings.d.ts.map