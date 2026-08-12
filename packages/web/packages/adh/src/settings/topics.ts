/** Left-sidebar sections inside User Settings, in rail order. Shared by hub's
 *  /settings route and the User Settings overlay every site mounts.
 *
 *  Import these from "@agentic-toolkit/adh/settings/topics" — this exact subpath, never
 *  the "@agentic-toolkit/adh/settings" barrel. This module carries no "use client" and
 *  imports nothing that does, so it is the one route into these exports a Server
 *  Component can use safely; the barrel re-exports SettingsOverlayProvider, which is
 *  "use client", and a built dist chunk hoists that directive onto everything else the
 *  same entry reaches. See settings/index.ts's own header comment for the full mechanism. */
export const SETTINGS_TOPICS = [
  { id: "appearance", label: "Appearance" },
  { id: "account", label: "Account" },
  { id: "security", label: "Security" },
  { id: "subscription", label: "Subscription" },
  { id: "usage", label: "Usage" },
  { id: "profile", label: "Profile" },
  { id: "social", label: "Social links" },
  { id: "addresses", label: "Addresses" },
  { id: "contacts", label: "Contact info" },
  { id: "notifications", label: "Notifications" },
  { id: "tokens", label: "API tokens" },
  { id: "assistants", label: "Assistants" },
  { id: "archived", label: "Archived" },
] as const;

export type SettingsTopicId = (typeof SETTINGS_TOPICS)[number]["id"];

/** Opening Settings lands on the first section in the rail (currently Appearance). */
export const DEFAULT_SETTINGS_TOPIC: string = SETTINGS_TOPICS[0].id;

const VALID_TOPICS: ReadonlySet<string> = new Set(SETTINGS_TOPICS.map((t) => t.id));

/** Clamp an arbitrary topic id to a known section, defaulting to the first. */
export function resolveSettingsTopic(activeTopic?: string): string {
  return activeTopic && VALID_TOPICS.has(activeTopic) ? activeTopic : DEFAULT_SETTINGS_TOPIC;
}
