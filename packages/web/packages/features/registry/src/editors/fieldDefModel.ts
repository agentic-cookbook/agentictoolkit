import { FIELD_TYPES, SHOW_IF_OPS } from '@agenticdevelopertoolkit/registry-types';
import type { FieldType, ShowIfRule } from '@agenticdevelopertoolkit/registry-types';
import { FIELD_VISIBILITIES } from '../client';
import type { FieldVisibility } from '../client';

/**
 * Everything the field-definition builder KNOWS, with none of what it looks like.
 *
 * Split out of `FieldDefEditor.tsx` because that component's markup is not the only markup
 * this builder is rendered in: `FieldDefEditor` is the zero-dependency rendering, for a host
 * with no design system of its own, and a host that HAS one (adh's hub) builds the same row
 * from its own primitives. What must not fork between the two is any of this — which ops a
 * subject type may be asked for, what an audience is called, what a freshly chosen op starts
 * from. A second copy of `coerceRuleValue` in a host would be a second place for R6-I2 to
 * come back, in one skin only, with nothing failing.
 */

export interface FieldDefDraft {
  id?: string;
  key: string;
  type: FieldType;
  label: string;
  help: string;
  required: boolean;
  visibility: FieldVisibility;
  config: Record<string, unknown>;
  /** Position within its section. Written by the builder's reorder control. */
  sortOrder: number;
  /** The declarative rule from §5 of the schema. `null` means "always applies". */
  showIf: ShowIfRule | null;
}

/**
 * What each catalog type is called to the owner. A `Record` so a member added to
 * `FIELD_TYPES` is a compile error here rather than an unlabelled option.
 */
export const TYPE_LABEL: Record<FieldType, string> = {
  text: 'Short text', textarea: 'Long text', markdown: 'Rich text',
  select: 'Choose one', multi_select: 'Choose several', url: 'Link',
  email: 'Email address', phone: 'Phone number', boolean: 'Yes or no',
  date: 'Date', image: 'Image', address: 'Address',
};

/**
 * Exhaustive for the same reason as `TYPE_LABEL`.
 *
 * These read as a CEILING, because that is what a def's setting is: the registrant may
 * narrow it further on their own entry but can never widen it. "Anyone" therefore means
 * "anyone, if the registrant agrees", and the labels say "at most" so the owner is not
 * told they are publishing something the registrant may have kept back.
 */
export const VISIBILITY_LABEL: Record<FieldVisibility, string> = {
  public: 'At most: anyone, including search engines',
  authenticated: 'At most: signed-in members',
  private: 'Only you and the registrant',
};

export type ShowIfOp = (typeof SHOW_IF_OPS)[number];

export const OP_LABEL: Record<ShowIfOp, string> = {
  eq: 'is', ne: 'is not', truthy: 'has any answer', falsy: 'has no answer',
  in: 'is one of', contains: 'includes',
};

/** The two ops that read the answer's presence, not its content. */
export const VALUELESS: ReadonlySet<string> = new Set(['truthy', 'falsy']);

/**
 * Ops whose value column a subject type can actually populate. `eq`/`ne` against a
 * `multi_select` answer can never match (the stored value is an array, an `eq` rule's value
 * is not), and `in`/`contains` against most scalar types are equally meaningless — so rather
 * than list every exclusion, only the two types with a narrower story than "the full set" are
 * named here; anything else (including a dangling rule with no resolvable subject) keeps every
 * op, per `opsFor` below.
 */
const OPS_BY_TYPE: Partial<Record<string, readonly ShowIfOp[]>> = {
  boolean: ['eq', 'ne', 'truthy', 'falsy'],
  multi_select: ['contains', 'truthy', 'falsy'],
};

export function opsFor(subjectType: string | undefined): readonly ShowIfOp[] {
  const narrowed = subjectType ? OPS_BY_TYPE[subjectType] : undefined;
  return narrowed ?? SHOW_IF_OPS;
}

/**
 * The value a freshly chosen (subject, op) pair should start from. Reuses the previous value
 * only when its shape still fits the new op/subject, so switching `in` -> `eq` never leaves an
 * array behind in a text box, and switching the subject away from `boolean` never leaves a
 * stray `true`/`false` selected for an op that now expects text.
 */
export function coerceRuleValue(
  op: string,
  subjectType: string | undefined,
  previous: unknown,
): unknown {
  if (VALUELESS.has(op)) return null;
  if (op === 'in') return Array.isArray(previous) ? previous : [];
  if (subjectType === 'boolean' && (op === 'eq' || op === 'ne')) {
    // A boolean subject's `eq`/`ne` can only ever be tested against `true` or `false` — an
    // empty string is not a value either state can equal, so `{op:'eq', value:''}` was a
    // rule that read false for every registrant forever, with nothing on screen saying why
    // (R6-I2). Defaulting to a real boolean instead of an empty string makes that state
    // unrepresentable: "Add a condition" on a boolean sibling now starts on an answer,
    // not an unchosen one.
    return typeof previous === 'boolean' ? previous : true;
  }
  return typeof previous === 'string' ? previous : '';
}

/**
 * The catalog and audience tuples, re-exported so a host builds its option lists from the
 * same source the server enforces rather than a hand-typed union.
 */
export { FIELD_TYPES, FIELD_VISIBILITIES };
