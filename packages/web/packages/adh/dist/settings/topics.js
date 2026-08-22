// src/settings/topics.ts
var SETTINGS_TOPICS = [
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
  { id: "usage", label: "Usage" }
];
var DEFAULT_SETTINGS_TOPIC = "appearance";
var VALID_TOPICS = new Set(SETTINGS_TOPICS.map((t) => t.id));
function resolveSettingsTopic(activeTopic) {
  return activeTopic && VALID_TOPICS.has(activeTopic) ? activeTopic : DEFAULT_SETTINGS_TOPIC;
}
export {
  DEFAULT_SETTINGS_TOPIC,
  SETTINGS_TOPICS,
  resolveSettingsTopic
};
//# sourceMappingURL=topics.js.map