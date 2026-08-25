export { FieldEditor } from './FieldEditor';
export type { FieldEditorProps } from './FieldEditor';
export { FieldDefEditor } from './FieldDefEditor';
export type { FieldDefEditorProps } from './FieldDefEditor';
// The builder's knowledge, separate from the zero-dependency rendering above it — a host
// with its own design system renders the row itself and imports these so the two skins
// cannot disagree about which ops a type takes or what an audience is called.
export {
  FIELD_TYPES,
  FIELD_VISIBILITIES,
  OP_LABEL,
  TYPE_LABEL,
  VALUELESS,
  VISIBILITY_LABEL,
  coerceRuleValue,
  opsFor,
} from './fieldDefModel';
export type { FieldDefDraft, ShowIfOp } from './fieldDefModel';
// The registrant-facing half of the same split: the entry form's knowledge, for a host that
// renders the row from its own primitives (adh's hub does) rather than from `FieldEditor`.
export {
  ADDRESS_PARTS,
  AUDIENCE_NOTE,
  CHOICE_LABEL,
  INPUT_TYPE,
  asText,
  optionsOf,
  tightestVisibility,
  visibilitiesWithin,
} from './fieldEntryModel';
