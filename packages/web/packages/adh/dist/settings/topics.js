// src/settings/topics.ts
var SETTINGS_TOPICS = [
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
  { id: "archived", label: "Archived" }
];
var DEFAULT_SETTINGS_TOPIC = SETTINGS_TOPICS[0].id;
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