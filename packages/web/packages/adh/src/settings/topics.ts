/** Left-sidebar sections inside User Settings, in rail order — alphabetical by label. Shared by hub's
 *  /settings route and the User Settings overlay every site mounts.
 *
 *  Import these from "@agentic-toolkit/adh/settings/topics" — this exact subpath, never
 *  the "@agentic-toolkit/adh/settings" barrel. This module carries no "use client" and
 *  imports nothing that does, so it is the one route into these exports a Server
 *  Component can use safely; the barrel re-exports SettingsOverlayProvider, which is
 *  "use client", and a built dist chunk hoists that directive onto everything else the
 *  same entry reaches. See settings/index.ts's own header comment for the full mechanism. */
export const SETTINGS_TOPICS = [
  { id: "account", label: "Account" },
  { id: "addresses", label: "Addresses" },
  { id: "tokens", label: "API tokens" },
  { id: "appearance", label: "Appearance" },
  { id: "archived", label: "Archived" },
  { id: "assistants", label: "Assistants" },
  { id: "contacts", label: "Contact info" },
  { id: "preferences", label: "Hub Preferences" },
  { id: "notifications", label: "Notifications" },
  { id: "profile", label: "Profile" },
  { id: "security", label: "Security" },
  { id: "social", label: "Social links" },
  { id: "subscription", label: "Subscription" },
  { id: "usage", label: "Usage" },
] as const;

export type SettingsTopicId = (typeof SETTINGS_TOPICS)[number]["id"];

/** Opening Settings lands on Appearance. Named outright rather than read off
 *  SETTINGS_TOPICS[0], because the rail is ordered alphabetically for the reader —
 *  so which section happens to sort first is not a statement about where to land. */
export const DEFAULT_SETTINGS_TOPIC: string = "appearance";

const VALID_TOPICS: ReadonlySet<string> = new Set(SETTINGS_TOPICS.map((t) => t.id));

/** Clamp an arbitrary topic id to a known section, defaulting to DEFAULT_SETTINGS_TOPIC. */
export function resolveSettingsTopic(activeTopic?: string): string {
  return activeTopic && VALID_TOPICS.has(activeTopic) ? activeTopic : DEFAULT_SETTINGS_TOPIC;
}
