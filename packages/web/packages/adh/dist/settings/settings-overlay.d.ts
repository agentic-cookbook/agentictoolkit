import { type ReactNode } from "react";
type SettingsOverlayContextValue = {
    openSettings: () => void;
};
/**
 * Open the user-settings overlay from anywhere under the provider. Returns null
 * when there is no provider, so a caller can tell "no settings here" from "settings
 * that do nothing" — the header uses that to decide whether the menu gets the row
 * at all, rather than rendering a row that silently no-ops.
 */
export declare function useSettingsOverlay(): SettingsOverlayContextValue | null;
/**
 * Hosts the single user-settings overlay above every site's routes and exposes
 * `openSettings` to its descendants. Mounted around the app shell so the overlay
 * layers over whatever route is showing.
 */
export declare function SettingsOverlayProvider({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
export {};
//# sourceMappingURL=settings-overlay.d.ts.map