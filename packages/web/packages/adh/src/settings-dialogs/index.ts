// MOVED to @agentic-toolkit/ecosystem-config/dialog-state, next to the dialogs these gates
// actually gate. This entry stays so the admin site's import path keeps compiling; new code
// imports the feature package directly.
//
// The move is what puts the dependency the right way up: the panes moved into a feature
// package, and a feature importing `adh` would invert the layering (`adh` already depends on
// `api-explorer` and `bitbag`). Re-exporting from here runs it adh → ecosystem-config instead.
export {
  type BagFormContext,
  type BagFormState,
  BAG_KEY_REQUIRED_MESSAGE,
  INVALID_JSON_MESSAGE,
  bagFormBlockedReason,
  duplicateBagKeyMessage,
  isBagFormDirty,
  type FlagFormContext,
  type FlagFormState,
  FLAG_KEY_REQUIRED_MESSAGE,
  PRISTINE_FLAG_FORM,
  duplicateFlagKeyMessage,
  flagFormBlockedReason,
  isFlagFormDirty,
} from "@agentic-toolkit/ecosystem-config/dialog-state";
