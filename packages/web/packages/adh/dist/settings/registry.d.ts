import { type Topic } from "@agentic-toolkit/account";
/** The settings sections (Account, Subscription, Profile) as master-detail
 *  topics — each leads with a gold title and carries its own panel + button bar.
 *  Shared by hub's /settings route and the User Settings overlay every site mounts. */
export declare function buildSettingsTopics(): Topic[];
/**
 * The User Settings tab, rendered as a routed page — used by hub's own /settings, and
 * kept available here for any other host that wants a standalone route rather than the
 * overlay. Builds its own SettingsDirtyProvider so a dirty panel is caught even under no
 * workspace chrome; the overlay (UserSettingsOverlay.tsx) wraps its own instance around
 * this same buildSettingsTopics() list instead of rendering this component, so the dirty
 * registry and the dialog frame are scoped to one mount.
 */
export declare function SettingsTab({ activeTopic }: {
    activeTopic?: string;
}): import("react").JSX.Element;
//# sourceMappingURL=registry.d.ts.map