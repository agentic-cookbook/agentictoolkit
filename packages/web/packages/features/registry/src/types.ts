// The whole catalog crosses, not just the validators. `evaluateShowIf` and `publishBlockers`
// are what let the entry editor decide which fields are in play and what is still blocking
// publish by calling the SAME functions the server calls — a registrant can never be shown an
// empty checklist and then told the entry cannot publish. Leaving either behind here would
// force the hub to re-derive the rule, which is the one way the two halves can disagree.
export {
  FIELD_TYPES, SHOW_IF_OPS, coerceFieldValue, evaluateShowIf, isFieldType, publishBlockers,
  searchableText, validateFieldValue,
} from '@agenticdevelopertoolkit/registry-types';
export type {
  AddressValue, FieldDefLike, FieldType, PublishBlocker, ShowIfOp, ShowIfRule,
} from '@agenticdevelopertoolkit/registry-types';
