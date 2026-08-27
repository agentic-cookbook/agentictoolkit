import { type ReactElement } from "react";
/**
 * Hub Preferences: the per-device choices about the hub's own chrome. One setting today —
 * the chord that opens the site menu.
 *
 * Saved to THIS BROWSER, not to the account, and the panel says so rather than leaving the
 * user to discover it: every other section here writes through to the user, so a section
 * that doesn't is the surprising one. The reasoning is in the store
 * (`header/hub-preferences.ts`); the short version is that a chord is a property of the
 * keyboard in front of you.
 *
 * Recording captures the NEXT keystroke rather than parsing a typed chord, because a chord
 * is only meaningful as the event it has to match: what "⌥S" produces depends on the layout
 * (on macOS, `ß`), so a chord typed into a text box can be one the keyboard can never
 * reproduce. Pressing the keys cannot be wrong in that way.
 */
export declare function HubPreferencesPanel(): ReactElement;
//# sourceMappingURL=HubPreferencesPanel.d.ts.map