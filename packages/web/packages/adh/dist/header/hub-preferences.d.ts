/** The hub's per-device chrome preferences. */
export type HubPreferences = {
    /** The chord that opens the site menu, in `@agentic-toolkit/ui/hooks/useShortcut`
     *  spelling (e.g. `'mod+shift+k'`). Empty string means the user turned it off —
     *  distinct from "unset", which falls back to {@link DEFAULT_SITE_MENU_SHORTCUT}. */
    siteMenuShortcut: string;
};
/**
 * ⌘⇧K (Ctrl+Shift+K off Apple).
 *
 * Chosen for what is NOT taken. `mod+k` is the projects command palette — the one other
 * chord this codebase registers globally — and the site menu is that palette's sibling
 * surface, so it wants to read as one key away rather than as an unrelated binding. The
 * `shift` is what buys the room: every single-modifier ⌘-letter on a Mac belongs to the
 * browser (⌘T/W/N/L/D/F/R/P/S/O and the digits), and `alt`+letter is unusable here on
 * principle rather than by accident — ⌥S emits `ß`, so an alt-letter chord stops matching
 * the moment the layout changes what the key produces.
 *
 * It is a DEFAULT, not a decision: the whole point of the Hub Preferences panel is that a
 * user whose browser does claim this one (Firefox binds ⌘⇧K to the web console) can move it.
 */
export declare const DEFAULT_SITE_MENU_SHORTCUT = "mod+shift+k";
/** The current preferences (a stable reference until the next write). */
export declare function readHubPreferences(): HubPreferences;
/** Set the site-menu chord. `''` turns the shortcut off; pass
 *  {@link DEFAULT_SITE_MENU_SHORTCUT} to restore the default. */
export declare function setSiteMenuShortcut(keys: string): void;
/**
 * Subscribe a component to the hub preferences. Server render + first paint yield the
 * DEFAULTS (localStorage is client-only) — matching the initial client snapshot
 * pre-hydration, so no mismatch — then the stored value flows through on the first write
 * or on hydration of a tab that already had one.
 */
export declare function useHubPreferences(): HubPreferences;
//# sourceMappingURL=hub-preferences.d.ts.map