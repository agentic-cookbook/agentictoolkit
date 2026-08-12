/** Left-sidebar sections inside User Settings, in rail order. Shared by hub's
 *  /settings route and the User Settings overlay every site mounts.
 *
 *  Import these from "@agentic-toolkit/adh/settings/topics" — this exact subpath, never
 *  the "@agentic-toolkit/adh/settings" barrel. This module carries no "use client" and
 *  imports nothing that does, so it is the one route into these exports a Server
 *  Component can use safely; the barrel re-exports SettingsOverlayProvider, which is
 *  "use client", and a built dist chunk hoists that directive onto everything else the
 *  same entry reaches. See settings/index.ts's own header comment for the full mechanism. */
export declare const SETTINGS_TOPICS: readonly [{
    readonly id: "appearance";
    readonly label: "Appearance";
}, {
    readonly id: "account";
    readonly label: "Account";
}, {
    readonly id: "security";
    readonly label: "Security";
}, {
    readonly id: "subscription";
    readonly label: "Subscription";
}, {
    readonly id: "usage";
    readonly label: "Usage";
}, {
    readonly id: "profile";
    readonly label: "Profile";
}, {
    readonly id: "social";
    readonly label: "Social links";
}, {
    readonly id: "addresses";
    readonly label: "Addresses";
}, {
    readonly id: "contacts";
    readonly label: "Contact info";
}, {
    readonly id: "notifications";
    readonly label: "Notifications";
}, {
    readonly id: "tokens";
    readonly label: "API tokens";
}, {
    readonly id: "assistants";
    readonly label: "Assistants";
}, {
    readonly id: "archived";
    readonly label: "Archived";
}];
export type SettingsTopicId = (typeof SETTINGS_TOPICS)[number]["id"];
/** Opening Settings lands on the first section in the rail (currently Appearance). */
export declare const DEFAULT_SETTINGS_TOPIC: string;
/** Clamp an arbitrary topic id to a known section, defaulting to the first. */
export declare function resolveSettingsTopic(activeTopic?: string): string;
//# sourceMappingURL=topics.d.ts.map