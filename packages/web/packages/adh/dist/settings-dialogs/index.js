// src/settings-dialogs/bag-dialog-state.ts
var INVALID_JSON_MESSAGE = 'Value must be valid JSON \u2014 e.g. true, 42, "text", or {"a": 1}.';
var BAG_KEY_REQUIRED_MESSAGE = "A key is required.";
var duplicateBagKeyMessage = (key) => `A bag named \u201C${key}\u201D already exists.`;
function isBagFormDirty(form, initial) {
  return form.key.trim() !== initial.key.trim() || form.valueText !== initial.valueText || form.description.trim() !== initial.description.trim();
}
function bagFormBlockedReason(form, ctx) {
  try {
    JSON.parse(form.valueText);
  } catch {
    return INVALID_JSON_MESSAGE;
  }
  if (!ctx.editingMode) {
    const trimmedKey = form.key.trim();
    if (!trimmedKey) return BAG_KEY_REQUIRED_MESSAGE;
    if (ctx.existingKeys.includes(trimmedKey)) return duplicateBagKeyMessage(trimmedKey);
  }
  return null;
}

// src/settings-dialogs/flag-dialog-state.ts
var PRISTINE_FLAG_FORM = { key: "", description: "", enabled: false };
var FLAG_KEY_REQUIRED_MESSAGE = "A key is required.";
var duplicateFlagKeyMessage = (key) => `A flag named \u201C${key}\u201D already exists.`;
function isFlagFormDirty(form, initial) {
  return form.key.trim() !== initial.key.trim() || form.description.trim() !== initial.description.trim() || form.enabled !== initial.enabled;
}
function flagFormBlockedReason(form, ctx) {
  if (ctx.editingMode) return null;
  const trimmedKey = form.key.trim();
  if (!trimmedKey) return FLAG_KEY_REQUIRED_MESSAGE;
  if (ctx.existingKeys.includes(trimmedKey)) return duplicateFlagKeyMessage(trimmedKey);
  return null;
}
export {
  BAG_KEY_REQUIRED_MESSAGE,
  FLAG_KEY_REQUIRED_MESSAGE,
  INVALID_JSON_MESSAGE,
  PRISTINE_FLAG_FORM,
  bagFormBlockedReason,
  duplicateBagKeyMessage,
  duplicateFlagKeyMessage,
  flagFormBlockedReason,
  isBagFormDirty,
  isFlagFormDirty
};
//# sourceMappingURL=index.js.map