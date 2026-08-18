'use client';

import { FIELD_TYPES, SHOW_IF_OPS } from '@agenticdevelopertoolkit/registry-types';
import type { FieldType, ShowIfRule } from '@agenticdevelopertoolkit/registry-types';
import { FIELD_VISIBILITIES } from '../client';
import type { FieldVisibility } from '../client';
import { noAutofillProps } from '../autofill';

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

export interface FieldDefEditorProps {
  def: FieldDefDraft;
  onChange: (def: FieldDefDraft) => void;
  onDelete?: () => void;
  /** The other fields in this section, for the rule's subject list. `type` drives which ops
   *  and which value control the rule offers — see `opsFor`/`coerceRuleValue` below. */
  siblings?: readonly { key: string; label: string; type: string }[];
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

const TYPE_LABEL: Record<FieldType, string> = {
  text: 'Short text', textarea: 'Long text', markdown: 'Rich text',
  select: 'Choose one', multi_select: 'Choose several', url: 'Link',
  email: 'Email address', phone: 'Phone number', boolean: 'Yes or no',
  date: 'Date', image: 'Image', address: 'Address',
};

// `Record`'s exhaustiveness means a member FIELD_VISIBILITIES gains later and this map does
// not is a compile error, not a silently missing <option> — same convention as TYPE_LABEL
// above.
//
// These read as a CEILING, because that is what a def's setting is: the registrant may
// narrow it further on their own entry but can never widen it. "Anyone" therefore means
// "anyone, if the registrant agrees", and the labels say "at most" so the owner is not
// told they are publishing something the registrant may have kept back.
const VISIBILITY_LABEL: Record<FieldVisibility, string> = {
  public: 'At most: anyone, including search engines',
  authenticated: 'At most: signed-in members',
  private: 'Only you and the registrant',
};

type ShowIfOp = (typeof SHOW_IF_OPS)[number];

const OP_LABEL: Record<ShowIfOp, string> = {
  eq: 'is', ne: 'is not', truthy: 'has any answer', falsy: 'has no answer',
  in: 'is one of', contains: 'includes',
};

/** The two ops that read the answer's presence, not its content. */
const VALUELESS = new Set(['truthy', 'falsy']);

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

function opsFor(subjectType: string | undefined): readonly ShowIfOp[] {
  const narrowed = subjectType ? OPS_BY_TYPE[subjectType] : undefined;
  return narrowed ?? SHOW_IF_OPS;
}

/**
 * The value a freshly chosen (subject, op) pair should start from. Reuses the previous value
 * only when its shape still fits the new op/subject, so switching `in` -> `eq` never leaves an
 * array behind in a text box, and switching the subject away from `boolean` never leaves a
 * stray `true`/`false` selected for an op that now expects text.
 */
function coerceRuleValue(op: string, subjectType: string | undefined, previous: unknown): unknown {
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
 * The builder's row for one field definition.
 *
 * Renders its own reorder pair and rule editor inline rather than importing
 * `@agentic-toolkit/ui/components/reorder-control` — this package ships zero runtime
 * dependencies on purpose (see its package.json's `//devDependencies` note: even
 * `@agentic-toolkit/auth` is dev-only, "so the shipped code carries no auth dependency at
 * all"), and `@agentic-toolkit/ui` is not among its peers or deps, so that import would not
 * resolve here. The behaviour still matches the fleet's control — disabled at the ends
 * rather than hidden, so the row's layout never jumps.
 */
export function FieldDefEditor({
  def, onChange, onDelete, siblings, onMoveUp, onMoveDown, canMoveUp, canMoveDown,
}: FieldDefEditorProps) {
  const set = <K extends keyof FieldDefDraft>(key: K, value: FieldDefDraft[K]) =>
    onChange({ ...def, [key]: value });

  const existing = Boolean(def.id);
  const wantsOptions = def.type === 'select' || def.type === 'multi_select';
  const rawOptions = Array.isArray(def.config.options) ? (def.config.options as string[]) : [];
  const subject = def.label || def.key || 'field';
  // Never itself: a field conditioned on its own answer is unreachable — hidden, so unset,
  // so hidden. The control simply does not offer it.
  const others = (siblings ?? []).filter((s) => s.key !== def.key);
  // The sibling the current rule names, if it still exists among `others`. A rule can outlive
  // its subject (the subject field gets deleted while this one's rule still points at its
  // key); `evaluateShowIf` doesn't error on that, it just can't resolve a value, so the rule
  // silently keeps hiding this field for every registrant. `dangling` surfaces that instead of
  // rendering a `<select>` that looks like nothing is wrong.
  const subjectDef = def.showIf ? others.find((s) => s.key === def.showIf!.field) : undefined;
  const dangling = def.showIf !== null && subjectDef === undefined;

  return (
    <div className="rf-def">
      {/* The plan named `@agentic-toolkit/ui`'s `ReorderControl` for this pair, and this
        * is a hand-rolled ↑/↓ instead. Not a shortcut — that component is unimportable
        * from here. It pulls in `lucide-react` for its two glyphs, `cn` (clsx +
        * tailwind-merge) for its class list, and the `Button` primitive, whose look comes
        * from Tailwind utilities and `--apt-*` tokens. This package declares ZERO runtime
        * dependencies and no Tailwind, on purpose: it is what a site outside the fleet
        * imports to render a registry, and such a site has no `@agentic-toolkit/ui`, no
        * Tailwind build and none of those tokens. Importing it would not merely add
        * weight, it would render unstyled there and would not resolve at all here —
        * `@agentic-toolkit/ui` is in neither this package's peers nor its deps.
        *
        * What is copied is the BEHAVIOUR the fleet control documents, because that part
        * is free: the pair is always visible rather than hover-revealed (a reorderable
        * list looks exactly like a fixed one, so a hidden affordance is one nobody
        * finds), and the end rows render their arrow DISABLED rather than dropping it,
        * so the column keeps its width and ↓ does not slide under the pointer mid-list.
        * Arrows, not chevrons — a chevron means disclosure in these packages.
        *
        * `ErrorText` below is replicated for exactly the same reason. */}
      {onMoveUp && onMoveDown ? (
        <div className="rf-def__order" role="group" aria-label={`Reorder ${subject}`}>
          <button
            type="button"
            aria-label={`Move up ${subject}`}
            disabled={!canMoveUp}
            onClick={onMoveUp}
          >
            ↑
          </button>
          <button
            type="button"
            aria-label={`Move down ${subject}`}
            disabled={!canMoveDown}
            onClick={onMoveDown}
          >
            ↓
          </button>
        </div>
      ) : null}

      <label>
        Label
        <input value={def.label} onChange={(e) => set('label', e.target.value)} {...noAutofillProps} />
      </label>

      <label>
        Key
        {/*
          Immutable once saved: values in every existing entry are stored under this key,
          so a rename orphans them all. The builder offers add-new + remove-old instead.
        */}
        <input value={def.key} disabled={existing}
          onChange={(e) => set('key', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
          {...noAutofillProps} />
      </label>

      <label>
        Type
        {/* Also immutable: an in-place retype has no correct answer for values that do
            not coerce, and the server rejects the attempt with a 400. */}
        <select value={def.type} disabled={existing}
          onChange={(e) => set('type', e.target.value as FieldType)}>
          {FIELD_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
        </select>
      </label>

      <label>
        Help text
        <input value={def.help} onChange={(e) => set('help', e.target.value)} {...noAutofillProps} />
      </label>

      <label>
        <input type="checkbox" checked={def.required}
          onChange={(e) => set('required', e.target.checked)} />
        Required
      </label>

      <label>
        Who can see it
        <select value={def.visibility} onChange={(e) => set('visibility', e.target.value as FieldVisibility)}>
          {FIELD_VISIBILITIES.map((v) => <option key={v} value={v}>{VISIBILITY_LABEL[v]}</option>)}
        </select>
      </label>

      {def.showIf ? (
        <div className="rf-def__rule">
          <label>
            Only show this when
            <select
              value={def.showIf.field}
              onChange={(e) => {
                const nextSubject = others.find((s) => s.key === e.target.value);
                const nextOps = opsFor(nextSubject?.type);
                const op = nextOps.includes(def.showIf!.op as ShowIfOp) ? def.showIf!.op : nextOps[0]!;
                set('showIf', {
                  field: e.target.value,
                  op,
                  value: coerceRuleValue(op, nextSubject?.type, def.showIf!.value),
                });
              }}
            >
              {/* A dangling rule's own field is not among `others` (it isn't a real sibling
                  any more) — offer it anyway, disabled, so the select shows what the data
                  actually says instead of silently falling back to the first real option. */}
              {dangling ? (
                <option value={def.showIf.field} disabled>
                  {def.showIf.field} (missing)
                </option>
              ) : null}
              {others.map((s) => (
                <option key={s.key} value={s.key}>{s.label || s.key}</option>
              ))}
            </select>
          </label>

          {dangling ? (
            // Replicates `@agentic-toolkit/ui`'s `ErrorText` (a `role="alert"` paragraph)
            // rather than importing it: this package ships zero runtime dependencies on
            // purpose (see the docblock above on `ReorderControl`), and `@agentic-toolkit/ui`
            // is not among its peers or deps, so the import would not resolve here.
            <p role="alert" className="rf-def__rule-error">
              This rule points at “{def.showIf.field}”, a field that no longer exists. Repoint
              it to a real field or remove it below — until then it keeps hiding this field.
            </p>
          ) : null}

          <label>
            Test
            <select
              value={def.showIf.op}
              onChange={(e) =>
                set('showIf', {
                  ...def.showIf!,
                  op: e.target.value,
                  value: coerceRuleValue(e.target.value, subjectDef?.type, def.showIf!.value),
                })
              }
            >
              {opsFor(subjectDef?.type).map((op) => (
                <option key={op} value={op}>{OP_LABEL[op]}</option>
              ))}
            </select>
          </label>

          {VALUELESS.has(def.showIf.op) ? null : (
            <label>
              {OP_LABEL[def.showIf.op as ShowIfOp] ?? 'is'}
              {def.showIf.op === 'in' ? (
                <input
                  value={Array.isArray(def.showIf.value) ? def.showIf.value.join(', ') : ''}
                  onChange={(e) =>
                    set('showIf', {
                      ...def.showIf!,
                      value: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  {...noAutofillProps}
                />
              ) : subjectDef?.type === 'boolean' && (def.showIf.op === 'eq' || def.showIf.op === 'ne') ? (
                <select
                  value={typeof def.showIf.value === 'boolean' ? String(def.showIf.value) : ''}
                  onChange={(e) => set('showIf', { ...def.showIf!, value: e.target.value === 'true' })}
                >
                  <option value="" disabled>Choose…</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              ) : (
                <input
                  value={typeof def.showIf.value === 'string' ? def.showIf.value : ''}
                  onChange={(e) => set('showIf', { ...def.showIf!, value: e.target.value })}
                  {...noAutofillProps}
                />
              )}
            </label>
          )}

          <button type="button" onClick={() => set('showIf', null)}>Always show this</button>
        </div>
      ) : others.length > 0 ? (
        <button
          type="button"
          onClick={() => {
            const subject = others[0]!;
            const op = opsFor(subject.type)[0]!;
            set('showIf', { field: subject.key, op, value: coerceRuleValue(op, subject.type, '') });
          }}
        >
          Add a condition
        </button>
      ) : null}

      {wantsOptions ? (
        <label>
          Options (one per line)
          <textarea rows={4} value={rawOptions.join('\n')} {...noAutofillProps}
            onChange={(e) =>
              set('config', {
                ...def.config,
                // De-duplicated: `FieldEditor` keys each option's element by the option
                // string, so a repeated line becomes two elements sharing one React key and,
                // for `multi_select`, two checkboxes LINKED to the same array entry —
                // checking one silently checks the other too.
                options: [...new Set(e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))],
              })
            } />
        </label>
      ) : null}

      {onDelete ? <button type="button" onClick={onDelete}>Remove field</button> : null}
    </div>
  );
}
