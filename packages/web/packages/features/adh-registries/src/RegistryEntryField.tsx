'use client';

import { useId } from 'react';
import { Field } from '@agenticdevelopertoolkit/ui/blocks';
import { Checkbox } from '@agenticdevelopertoolkit/ui/components/checkbox';
import { FieldFootnote } from '@agenticdevelopertoolkit/ui/components/field-footnote';
import { Input } from '@agenticdevelopertoolkit/ui/components/input';
import { Label } from '@agenticdevelopertoolkit/ui/components/label';
import { Select } from '@agenticdevelopertoolkit/ui/components/select';
import { Textarea } from '@agenticdevelopertoolkit/ui/components/textarea';
import { fieldCaptionClass } from '@agenticdevelopertoolkit/ui/lib/typography';
import {
  ADDRESS_PARTS,
  AUDIENCE_NOTE,
  CHOICE_LABEL,
  INPUT_TYPE,
  asText,
  optionsOf,
  tightestVisibility,
  visibilitiesWithin,
} from '@agentic-toolkit/registry/editors';
import type { FieldDefRow, FieldVisibility } from '@agentic-toolkit/registry/client';

export interface RegistryEntryFieldProps {
  /** The owner's definition, whose `visibility` is the CEILING for this field — the widest
   *  audience it may ever reach on any entry, not this entry's own setting. */
  def: FieldDefRow;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string | null;
  /** This entry's own audience choice, when the registrant has made one. Absent follows the
   *  def, which resolves to the ceiling. */
  visibility?: FieldVisibility;
  /** Supplied by a host that lets the registrant choose. Omit it and the field STATES its
   *  audience instead of offering it — which is what the owner's own preview wants. */
  onVisibilityChange?: (visibility: FieldVisibility) => void;
}

/**
 * One registrant-facing field, in the hub's own vocabulary.
 *
 * The sibling of `RegistryFieldPanel` on the other side of the same split, and it exists for
 * the same reason: `@agentic-toolkit/registry` ships `FieldEditor`, which renders this row as
 * bare `<label><input>` pairs because that package declares zero runtime dependencies — right
 * for a site outside this fleet with no design system, wrong for the hub, which has one and
 * builds every neighbouring pane from it. So the hub renders the row from `Field`/`Input`/
 * `Select`/`Textarea`/`Checkbox` and imports the package's `fieldEntryModel` for everything
 * that is knowledge rather than markup: what each audience is CALLED, which `<input type>` a
 * catalog type takes, how a stored value becomes text, and the clamping rules.
 *
 * Three accessibility invariants are carried over from `FieldEditor` verbatim, because they
 * were each fixed there once and a skin that re-derived them would lose them again:
 *
 * 1. `multi_select` and `address` render a GROUP, not a labelable control, so they take their
 *    name from `aria-labelledby` — a `<label for>` is honoured only against a labelable
 *    element, and pointing one at a `<div>` LOOKS repaired while activating nothing.
 * 2. The audience note and the error are space-joined into `aria-describedby`, never
 *    substituted, so a field that is both narrowed AND invalid announces both.
 * 3. The picker's accessible name is written out as `Who can see this <label>` rather than
 *    composed with `aria-labelledby`: a label reference would make the picker answer to the
 *    FIELD's label too, so `getByLabelText('Site')` would match two controls. The visible
 *    text stays a PREFIX of that name, which is what keeps speech input working (WCAG 2.5.3).
 */
export function RegistryEntryField({
  def, value, onChange, error, visibility, onVisibilityChange,
}: RegistryEntryFieldProps) {
  const id = useId();
  // A def with no stated visibility is `public` — the same default `defaultVisibilityForType`
  // gives a non-contact type, and the only fail-open reading that is safe here: this renders
  // a value the server already decided to send, so a missing ceiling widens no audience, it
  // only decides which words appear beside the control.
  const ceiling: FieldVisibility = def.visibility ?? 'public';
  const effective = tightestVisibility(visibility ?? ceiling, ceiling);
  const choices = visibilitiesWithin(ceiling);
  // Two conditions, both necessary. No handler means the host is not offering the choice; one
  // choice means the ceiling IS the answer, and a `<select>` whose only option is already
  // selected reads as a decision the registrant made rather than one made for them.
  const picker = onVisibilityChange !== undefined && choices.length > 1;
  const note = picker ? null : AUDIENCE_NOTE[effective];
  const describedBy = [note ? `${id}-vis` : null, error ? `${id}-err` : null]
    .filter((v): v is string => v !== null)
    .join(' ');
  const invalid = {
    ...(error ? { 'aria-invalid': true as const } : {}),
    ...(describedBy ? { 'aria-describedby': describedBy } : {}),
  };
  const isGroup = def.type === 'multi_select' || def.type === 'address';

  const control = (() => {
    switch (def.type) {
      case 'textarea':
      case 'markdown':
        return (
          <Textarea
            id={id}
            rows={def.type === 'markdown' ? 10 : 4}
            value={asText(value)}
            onChange={(e) => onChange(e.target.value)}
            {...invalid}
          />
        );

      case 'boolean':
        return (
          <Checkbox
            id={id}
            checked={value === true}
            onCheckedChange={(checked) => onChange(checked === true)}
            {...invalid}
          />
        );

      case 'select':
        return (
          <Select id={id} value={asText(value)} onChange={(e) => onChange(e.target.value)} {...invalid}>
            <option value="">—</option>
            {optionsOf(def).map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </Select>
        );

      case 'multi_select': {
        const selected = Array.isArray(value) ? value.map(String) : [];
        return (
          <div
            role="group"
            aria-labelledby={`${id}-label`}
            className="flex flex-wrap gap-x-4 gap-y-2"
            {...invalid}
          >
            {optionsOf(def).map((o) => (
              <Label key={o} className="font-normal">
                <Checkbox
                  checked={selected.includes(o)}
                  onCheckedChange={(checked) =>
                    onChange(checked === true ? [...selected, o] : selected.filter((s) => s !== o))
                  }
                />
                {o}
              </Label>
            ))}
          </div>
        );
      }

      case 'address': {
        const a = (typeof value === 'object' && value !== null ? value : {}) as Record<string, string>;
        return (
          <div
            role="group"
            aria-labelledby={`${id}-label`}
            className="grid w-full gap-2 sm:grid-cols-2"
            {...invalid}
          >
            {ADDRESS_PARTS.map(([key, label]) => (
              <Field key={key} label={label}>
                {/* An address on a registry ENTRY, not the reader's own — `Input` opts out of
                    autofill by default, which is what keeps the browser and every password
                    manager from offering theirs. */}
                <Input
                  value={a[key] ?? ''}
                  onChange={(e) => onChange({ ...a, [key]: e.target.value })}
                />
              </Field>
            ))}
          </div>
        );
      }

      case 'image':
        // The value is an attachment id from the presigned upload flow. The upload UI is the
        // host site's; this control accepts the id the site hands back.
        return (
          <Input
            id={id}
            type="text"
            placeholder="Attachment id"
            value={asText(value)}
            onChange={(e) => onChange(e.target.value)}
            {...invalid}
          />
        );

      case 'date':
        return (
          <Input
            id={id}
            type="date"
            value={asText(value)}
            onChange={(e) => onChange(e.target.value)}
            {...invalid}
          />
        );

      case 'url':
      case 'email':
      case 'phone':
      case 'text':
      default:
        return (
          <Input
            id={id}
            type={INPUT_TYPE[def.type] ?? 'text'}
            value={asText(value)}
            onChange={(e) => onChange(e.target.value)}
            {...invalid}
          />
        );
    }
  })();

  // `def.label` stays a DIRECT text child of the caption, with the marker as an element
  // beside it: testing-library reads an element's own text nodes, so this is what lets a
  // consumer still match the field by its bare label while the rendered row says "Bio *".
  const heading = (
    <>
      {def.label}
      {def.required ? <span aria-hidden="true"> *</span> : null}
    </>
  );

  return (
    <div className="flex flex-col items-start gap-1.5">
      {isGroup ? (
        <span className={fieldCaptionClass} id={`${id}-label`}>{heading}</span>
      ) : (
        <Label className={fieldCaptionClass} htmlFor={id} id={`${id}-label`}>{heading}</Label>
      )}
      {control}
      {/* The owner's help and this field's error share one slot, error winning — the fleet's
          rule for every other form row, and the reason `FieldFootnote` owns that precedence
          instead of each caller re-deciding it. `errorId` names the error line so the control
          above can describe itself by it. */}
      <FieldFootnote hint={def.help || undefined} error={error || undefined} errorId={`${id}-err`} />
      {picker ? (
        <div className="flex flex-wrap items-center gap-2">
          <Label className={fieldCaptionClass} htmlFor={`${id}-vis`}>Who can see this</Label>
          <Select
            id={`${id}-vis`}
            aria-label={`Who can see this ${def.label}`}
            className="h-8 w-auto text-xs"
            value={effective}
            onChange={(e) => onVisibilityChange!(e.target.value as FieldVisibility)}
          >
            {choices.map((v) => (
              <option key={v} value={v}>{CHOICE_LABEL[v]}</option>
            ))}
          </Select>
        </div>
      ) : note ? (
        // Said plainly, per field, and tied to the control via `aria-describedby` above — a
        // registrant who cannot tell what reaches the public page either withholds everything
        // or publishes something they meant to keep back, and a screen reader user gets no
        // hint at all from an unassociated paragraph.
        <p className="font-mono text-[0.7rem] text-apt-text-dim" id={`${id}-vis`}>{note}</p>
      ) : null}
    </div>
  );
}
