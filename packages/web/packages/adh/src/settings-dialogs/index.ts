/**
 * Save-gates for the ecosystem settings dialogs that admin and hub BOTH render.
 *
 * Each form's gate is one pure `blockedReason(form, ctx): string | null` plus its dirty check and
 * its message constants, so the disabled button and the submit path's throw read the same
 * sentence and the two apps cannot drift apart again.
 *
 * Message constants are form-qualified (`BAG_KEY_REQUIRED_MESSAGE` vs `FLAG_KEY_REQUIRED_MESSAGE`)
 * even where the text currently coincides: two dialogs happening to say the same words is not the
 * same fact, and collapsing them would make either one impossible to reword on its own.
 */
export {
  type BagFormContext,
  type BagFormState,
  BAG_KEY_REQUIRED_MESSAGE,
  INVALID_JSON_MESSAGE,
  bagFormBlockedReason,
  duplicateBagKeyMessage,
  isBagFormDirty,
} from "./bag-dialog-state";

export {
  type FlagFormContext,
  type FlagFormState,
  FLAG_KEY_REQUIRED_MESSAGE,
  PRISTINE_FLAG_FORM,
  duplicateFlagKeyMessage,
  flagFormBlockedReason,
  isFlagFormDirty,
} from "./flag-dialog-state";
