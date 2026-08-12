/**
 * The User Settings master-detail (Account / Subscription / Profile) shown as a
 * centered overlay over whatever route is underneath — opened by the header's
 * settings gear. Identical UI to hub's /settings, but section switching is in-place
 * (controlled state, not routing) so the underlying route is preserved.
 */
export declare function UserSettingsOverlay({ open, onOpenChange, }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}): import("react").JSX.Element;
export { buildSettingsTopics, SettingsTab } from "./registry";
export type { Topic } from "@agentic-toolkit/account";
//# sourceMappingURL=UserSettingsOverlay.d.ts.map