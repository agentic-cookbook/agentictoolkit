'use client';

import { useState } from 'react';
import { Field, FieldGroup } from '@agenticdevelopertoolkit/ui/blocks';
import { Button } from '@agenticdevelopertoolkit/ui/components/button';
import { Checkbox } from '@agenticdevelopertoolkit/ui/components/checkbox';
import { ErrorText } from '@agenticdevelopertoolkit/ui/components/error-text';
import { Input } from '@agenticdevelopertoolkit/ui/components/input';
import { Label } from '@agenticdevelopertoolkit/ui/components/label';
import { ReorderControl } from '@agenticdevelopertoolkit/ui/components/reorder-control';
import { Select } from '@agenticdevelopertoolkit/ui/components/select';
import { Textarea } from '@agenticdevelopertoolkit/ui/components/textarea';
import {
  FIELD_TYPES,
  FIELD_VISIBILITIES,
  OP_LABEL,
  TYPE_LABEL,
  VALUELESS,
  VISIBILITY_LABEL,
  coerceRuleValue,
  opsFor,
} from '@agentic-toolkit/registry/editors';
import type { FieldDefDraft, ShowIfOp } from '@agentic-toolkit/registry/editors';
import type { FieldVisibility } from '@agentic-toolkit/registry/client';
import type { FieldType } from '@agentic-toolkit/registry/types';
import { keyProblem, slugify } from './slug';

/** One option per line, trimmed, blanks dropped, de-duplicated — see the Options field below. */
function parseOptions(text: string): string[] {
  return [...new Set(text.split('\n').map((s) => s.trim()).filter(Boolean))];
}

export interface RegistryFieldPanelProps {
  def: FieldDefDraft;
  onChange: (def: FieldDefDraft) => void;
  onDelete: () => void;
  /** The other fields in this section, for the condition's subject list. */
  siblings: readonly { key: string; label: string; type: string }[];
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

/**
 * One field definition, in the hub's own vocabulary.
 *
 * The registry package ships `FieldDefEditor`, which renders this same row as bare
 * `<label><input>` pairs. That is deliberate THERE — the package declares zero runtime
 * dependencies so a site outside this fleet can render a registry with no design system at
 * all — and it is wrong HERE: the hub has a design system, every other pane in this editor
 * is built from it, and a pane of unstyled form markup in the middle of them is not a
 * theming gap to paper over with a stylesheet, it is the wrong component. So the hub renders
 * the row itself, from `Field`/`Input`/`Select`/`Checkbox`/`ReorderControl` like its
 * neighbours, and imports the package's `fieldDefModel` for everything that is knowledge
 * rather than markup — the type and audience labels, which ops a subject type admits, and
 * what a freshly chosen op starts from. Nothing about the rule algebra is restated here.
 */
export function RegistryFieldPanel({
  def, onChange, onDelete, siblings, onMoveUp, onMoveDown, canMoveUp, canMoveDown,
}: RegistryFieldPanelProps) {
  const set = <K extends keyof FieldDefDraft>(key: K, value: FieldDefDraft[K]) =>
    onChange({ ...def, [key]: value });

  const existing = Boolean(def.id);

  // Whether the owner has typed in the Key box themselves. Until they do, the key is DERIVED from
  // the label, the way a registry's own address is derived from its name in the create dialog —
  // and for the same reason: `addField` mints `key: ''`, nothing else on the way to the server
  // filled it in, and a blank key is the server's own 400. Deriving it means the ordinary path
  // (type a label, press Save) simply works, and the box stays editable for the owner who wants a
  // different key. Local state is safe here because `RegistrySectionPanel` keys this component on
  // the row's `clientKey`, which is stable for the row's whole life.
  const [keyEdited, setKeyEdited] = useState(false);

  // The Options textarea's raw text, so a newline the owner just typed survives the round trip
  // through `config.options`. `parseOptions` drops the empty last line, so a value re-derived
  // from the parsed array on every keystroke deleted the Enter as fast as it was pressed and a
  // second option could not be typed at all. The parse is what is STORED; this is what is SHOWN.
  const [optionsText, setOptionsText] = useState(() =>
    (Array.isArray(def.config.options) ? (def.config.options as string[]) : []).join('\n'),
  );
  const wantsOptions = def.type === 'select' || def.type === 'multi_select';
  const rawOptions = Array.isArray(def.config.options) ? (def.config.options as string[]) : [];
  // …and when the stored options change from OUTSIDE this box — a Cancel reverting the draft, a
  // reload landing the server's copy — the raw text goes back to matching them. Compared through
  // the parse so the owner's own trailing newline is not treated as a divergence. A render-phase
  // adjustment, which is React's supported way to reset state when a prop changes.
  const storedOptions = rawOptions.join('\n');
  if (parseOptions(optionsText).join('\n') !== storedOptions) setOptionsText(storedOptions);
  // What this row is CALLED in the accessible names of its own controls — "Move up Bio",
  // "Remove Bio". The key is the fallback because a field is nameable before it is labelled;
  // the bare word is the last resort, and it is the same last resort the package's own
  // rendering uses, so the two skins announce a nameless row identically.
  const subject = def.label || def.key || 'field';
  // The heading says the row is new, where `subject` above must stay a noun phrase that
  // reads inside "Move up …".
  const heading = def.label || def.key || 'New field';
  // Never itself: a field conditioned on its own answer is unreachable — hidden, so unset,
  // so hidden. The control simply does not offer it.
  //
  // And never a keyless one. A rule names its subject BY KEY, so a sibling that has no key yet
  // cannot be one: the rule would save as `{ field: '' }`, `evaluateShowIf` would resolve nothing
  // and hide this field from every registrant forever. Two of them in a section also gave the
  // `<option>` list two children keyed `''`, and made `find` on `''` return whichever came first
  // rather than the row the rule meant. They come back into the list the moment they are labelled.
  const others = siblings.filter((s) => s.key !== '' && s.key !== def.key);
  // The sibling the current rule names, if it still exists among `others`. A rule can outlive
  // its subject (the subject field gets deleted while this one's rule still points at its
  // key); `evaluateShowIf` doesn't error on that, it just can't resolve a value, so the rule
  // silently keeps hiding this field for every registrant. `dangling` surfaces that instead of
  // rendering a Select that looks like nothing is wrong.
  const subjectDef = def.showIf ? others.find((s) => s.key === def.showIf!.field) : undefined;
  const dangling = def.showIf !== null && subjectDef === undefined;

  return (
    <FieldGroup
      title={heading}
      trailing={
        <div className="flex items-center gap-2">
          {/* The fleet's own control, where the package hand-rolls a matching pair it cannot
              import. Same behaviour either way: always visible, disabled at the ends rather
              than dropped, so the column keeps its width mid-list. */}
          <ReorderControl
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            subject={subject}
          />
          <Button variant="destructive-ghost" size="sm" onClick={onDelete}>
            {`Remove ${subject}`}
          </Button>
        </div>
      }
    >
      <Field label="Label">
        <Input
          value={def.label}
          onChange={(e) => {
            const label = e.target.value;
            // Both at once, not `set` twice: `set` folds onto the `def` this render closed over,
            // so a second call would discard the first one's change.
            onChange(
              existing || keyEdited ? { ...def, label } : { ...def, label, key: slugify(label) },
            );
          }}
        />
      </Field>

      <Field
        label="Key"
        hint={
          existing
            ? 'Fixed once saved — every entry stores its answers under this key.'
            : 'Made from the label. Lowercase letters, numbers and dashes.'
        }
        // The same rule the save bar refuses on, said at the box that can fix it. Silent on a row
        // still blank in both places, which is a row being added rather than a mistake — the bar
        // names that one, because a brand-new field needs a label before it needs a key.
        error={existing || (def.key === '' && def.label === '') ? null : keyProblem(def.key)}
      >
        {/*
          Immutable once saved: values in every existing entry are stored under this key,
          so a rename orphans them all. The builder offers add-new + remove-old instead.
        */}
        <Input
          value={def.key}
          disabled={existing}
          onChange={(e) => {
            setKeyEdited(true);
            set('key', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
          }}
        />
      </Field>

      <Field
        label="Type"
        hint={existing ? 'Fixed once saved — existing answers may not convert.' : undefined}
      >
        {/* Also immutable: an in-place retype has no correct answer for values that do
            not coerce, and the server rejects the attempt with a 400. */}
        <Select
          value={def.type}
          disabled={existing}
          onChange={(e) => set('type', e.target.value as FieldType)}
        >
          {FIELD_TYPES.map((t) => (
            <option key={t} value={t}>{TYPE_LABEL[t]}</option>
          ))}
        </Select>
      </Field>

      <Field label="Help text" hint="Shown under the control on the registrant's form.">
        <Input value={def.help} onChange={(e) => set('help', e.target.value)} />
      </Field>

      {/* The shared `Label` rather than `Field`: a boolean's caption trails its box, and
          `Field` puts every caption above. Same shape RegistryDetailsPanel uses for its
          own checkbox. */}
      <Label className="font-normal">
        <Checkbox
          checked={def.required}
          onCheckedChange={(checked) => set('required', checked === true)}
        />
        Required
      </Label>

      <Field label="Who can see it">
        <Select
          value={def.visibility}
          onChange={(e) => set('visibility', e.target.value as FieldVisibility)}
        >
          {FIELD_VISIBILITIES.map((v) => (
            <option key={v} value={v}>{VISIBILITY_LABEL[v]}</option>
          ))}
        </Select>
      </Field>

      {def.showIf ? (
        <div className="flex flex-col gap-3 rounded-md border border-apt-border p-3">
          <Field label="Only show this when">
            <Select
              value={def.showIf.field}
              onChange={(e) => {
                const nextSubject = others.find((s) => s.key === e.target.value);
                const nextOps = opsFor(nextSubject?.type);
                const op = nextOps.includes(def.showIf!.op as ShowIfOp)
                  ? def.showIf!.op
                  : nextOps[0]!;
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
                  {def.showIf.field === ''
                    ? 'no field chosen'
                    : `${def.showIf.field} (missing)`}
                </option>
              ) : null}
              {others.map((s) => (
                <option key={s.key} value={s.key}>{s.label || s.key}</option>
              ))}
            </Select>
          </Field>

          <ErrorText
            error={
              dangling
                ? def.showIf.field === ''
                  ? 'This rule names no field, so it can never be true — it just keeps this field hidden. Pick a field or remove the condition.'
                  : `This rule points at “${def.showIf.field}”, a field that no longer exists. Repoint it to a real field or remove the condition — until then it keeps hiding this field.`
                : null
            }
          />

          <Field label="Test">
            <Select
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
            </Select>
          </Field>

          {VALUELESS.has(def.showIf.op) ? null : (
            <Field
              label={OP_LABEL[def.showIf.op as ShowIfOp] ?? 'is'}
              hint={def.showIf.op === 'in' ? 'Separate the answers with commas.' : undefined}
            >
              {def.showIf.op === 'in' ? (
                <Input
                  value={Array.isArray(def.showIf.value) ? def.showIf.value.join(', ') : ''}
                  onChange={(e) =>
                    set('showIf', {
                      ...def.showIf!,
                      value: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                />
              ) : subjectDef?.type === 'boolean' &&
                (def.showIf.op === 'eq' || def.showIf.op === 'ne') ? (
                <Select
                  value={typeof def.showIf.value === 'boolean' ? String(def.showIf.value) : ''}
                  onChange={(e) =>
                    set('showIf', { ...def.showIf!, value: e.target.value === 'true' })
                  }
                >
                  <option value="" disabled>Choose…</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </Select>
              ) : (
                <Input
                  value={typeof def.showIf.value === 'string' ? def.showIf.value : ''}
                  onChange={(e) => set('showIf', { ...def.showIf!, value: e.target.value })}
                />
              )}
            </Field>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => set('showIf', null)}
          >
            Always show this
          </Button>
        </div>
      ) : others.length > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() => {
            const first = others[0]!;
            const op = opsFor(first.type)[0]!;
            set('showIf', { field: first.key, op, value: coerceRuleValue(op, first.type, '') });
          }}
        >
          Add a condition
        </Button>
      ) : null}

      {wantsOptions ? (
        <Field label="Options" hint="One per line.">
          <Textarea
            rows={4}
            value={optionsText}
            onChange={(e) => {
              setOptionsText(e.target.value);
              // De-duplicated by `parseOptions`: `FieldEditor` keys each option's element by the
              // option string, so a repeated line becomes two elements sharing one React key and,
              // for `multi_select`, two checkboxes LINKED to the same array entry — checking one
              // silently checks the other too.
              set('config', { ...def.config, options: parseOptions(e.target.value) });
            }}
          />
        </Field>
      ) : null}
    </FieldGroup>
  );
}
