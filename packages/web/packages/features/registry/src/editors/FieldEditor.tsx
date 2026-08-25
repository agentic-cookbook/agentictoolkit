'use client';

import { useId } from 'react';
import type { FieldDefLike } from '@agenticdevelopertoolkit/registry-types';
import type { FieldVisibility } from '../client';
import { noAutofillProps } from '../autofill';
// The labels, the type mapping and the clamping rules — see `fieldEntryModel`. What is left
// in this file is the zero-dependency MARKUP, which is the only part a design-system host
// replaces.
import {
  ADDRESS_PARTS,
  AUDIENCE_NOTE,
  CHOICE_LABEL,
  INPUT_TYPE,
  asText,
  optionsOf,
  tightestVisibility,
  visibilitiesWithin,
} from './fieldEntryModel';

export interface FieldEditorProps {
  /**
   * The field definition, whose `visibility` is the registry owner's CEILING — the widest
   * audience this field may ever reach on any entry, not this entry's setting.
   *
   * `FieldVisibility`, not a second hand-typed union: `client.ts` re-exports the tuple the
   * server enforces, so a member added there is a compile error at every derived `<option>`
   * list and label map. This boundary silently kept accepting the old two-member set until
   * it was tied to that type.
   */
  def: FieldDefLike & { label: string; help?: string; visibility?: FieldVisibility };
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string | null;
  /**
   * The registrant's own setting for this field on THIS entry, when they have one. Absent
   * means "follows the def", which resolves to the ceiling.
   *
   * Rendered as the TIGHTER of this and the ceiling, never as-is: an owner who narrows a
   * def leaves every entry's stored override untouched, so a stale wider value outlives the
   * change and the server clamps it on read. Showing the stored value would tell the
   * registrant they are publishing something the server is already withholding.
   */
  visibility?: FieldVisibility;
  /**
   * Supplied by a host that lets the registrant choose. Omit it and this component states
   * the audience instead of offering it — which is what the registry OWNER's own preview
   * of the form wants, and what a read-only rendering wants.
   *
   * The choices offered are `visibilitiesWithin(ceiling)`: a registrant may only TIGHTEN.
   * Loosening past the ceiling would publish, to the whole internet, a field the owner
   * deliberately scoped — so the server rejects it with a 400 and this picker never offers
   * it in the first place.
   */
  onVisibilityChange?: (visibility: FieldVisibility) => void;
}

/**
 * One control per catalog type.
 *
 * `onChange` reports the TYPED value — a boolean, an array, an address object — never the
 * raw event target. The caller stores what it is handed, so a control that leaked
 * `event.target.value` would put a string where the validator expects an array.
 */
export function FieldEditor({
  def, value, onChange, error, visibility, onVisibilityChange,
}: FieldEditorProps) {
  const id = useId();
  // A def with no stated visibility is `public` — the same default `defaultVisibilityForType`
  // gives a non-contact type, and the only fail-open reading that is safe here: this
  // component RENDERS a value the server already decided to send, so a missing ceiling
  // widens no audience, it only affects which words appear beside the control.
  const ceiling: FieldVisibility = def.visibility ?? 'public';
  const effective = tightestVisibility(visibility ?? ceiling, ceiling);
  const choices = visibilitiesWithin(ceiling);
  // Two conditions, both necessary. No handler means the host is not offering the choice.
  // One choice means the ceiling IS the answer — a `<select>` whose only option is already
  // selected is a control that cannot do anything, and it reads as a decision the
  // registrant made rather than one the owner made for them.
  const picker = onVisibilityChange !== undefined && choices.length > 1;
  // Said in prose only where there is no picker to say it: with one, the chosen option is
  // already on screen and a second sentence repeating it is noise.
  const note = picker ? null : AUDIENCE_NOTE[effective];
  // Space-joined, not replaced: `aria-describedby` takes a list of ids, and a control that
  // is both narrowed AND invalid needs a screen reader to read both notes, not whichever one
  // was assigned last.
  const describedBy = [note ? `${id}-vis` : null, error ? `${id}-err` : null]
    .filter((v): v is string => v !== null)
    .join(' ');
  const invalid = {
    ...(error ? { 'aria-invalid': true as const } : {}),
    ...(describedBy ? { 'aria-describedby': describedBy } : {}),
  };
  // Which types render a GROUP rather than one labelable control, decided beside the switch
  // that renders them. `htmlFor` is honoured only against a labelable element (input, select,
  // textarea, …), so on the `multi_select` and `address` branches the shared heading's `for`
  // pointed at nothing and clicking the label focused nothing — and giving those `<div>`s an
  // `id={id}` would have made the association LOOK repaired while changing no behaviour at
  // all, since the browser still would not activate it. They take their accessible name from
  // `aria-labelledby={`${id}-label`}` instead, which any element can satisfy, so the heading
  // below simply does not claim a `for` it cannot honour. FieldEditor.test.tsx asserts the
  // invariant over the whole catalog — every `for` this component emits resolves to a
  // labelable element — so a type added later cannot reintroduce a dangling one.
  const isGroup = def.type === 'multi_select' || def.type === 'address';

  const control = (() => {
    switch (def.type) {
      case 'textarea':
      case 'markdown':
        return (
          <textarea id={id} rows={def.type === 'markdown' ? 10 : 4} value={asText(value)}
            onChange={(e) => onChange(e.target.value)} {...noAutofillProps} {...invalid} />
        );

      case 'boolean':
        return (
          <input id={id} type="checkbox" checked={value === true}
            onChange={(e) => onChange(e.target.checked)} {...invalid} />
        );

      case 'select':
        return (
          <select id={id} value={asText(value)} onChange={(e) => onChange(e.target.value)} {...invalid}>
            <option value="">—</option>
            {optionsOf(def).map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        );

      case 'multi_select': {
        const selected = Array.isArray(value) ? value.map(String) : [];
        return (
          <div role="group" aria-labelledby={`${id}-label`} {...invalid}>
            {optionsOf(def).map((o) => (
              <label key={o}>
                <input type="checkbox" checked={selected.includes(o)}
                  onChange={(e) =>
                    onChange(e.target.checked ? [...selected, o] : selected.filter((s) => s !== o))
                  } />
                {o}
              </label>
            ))}
          </div>
        );
      }

      case 'address': {
        const a = (typeof value === 'object' && value !== null ? value : {}) as Record<string, string>;
        const part = (key: string, label: string) => (
          <label key={key}>
            {label}
            {/* An address on a registry ENTRY, not the reader's own — without the
                opt-out the browser and every manager offer to fill in theirs. */}
            <input value={a[key] ?? ''} onChange={(e) => onChange({ ...a, [key]: e.target.value })}
              {...noAutofillProps} />
          </label>
        );
        return (
          <div role="group" aria-labelledby={`${id}-label`} {...invalid}>
            {ADDRESS_PARTS.map(([key, label]) => part(key, label))}
          </div>
        );
      }

      case 'image':
        // The value is an attachment id from the presigned upload flow. The upload UI is
        // the host site's; this control accepts the id the site hands back.
        return (
          <input id={id} type="text" placeholder="Attachment id" value={asText(value)}
            onChange={(e) => onChange(e.target.value)} {...noAutofillProps} {...invalid} />
        );

      case 'date':
        return (
          <input id={id} type="date" value={asText(value)}
            onChange={(e) => onChange(e.target.value)} {...noAutofillProps} {...invalid} />
        );

      case 'url':
      case 'email':
      case 'phone':
      case 'text':
      default:
        return (
          <input id={id} type={INPUT_TYPE[def.type] ?? 'text'} value={asText(value)}
            onChange={(e) => onChange(e.target.value)} {...noAutofillProps} {...invalid} />
        );
    }
  })();

  const heading = (
    <>
      {def.label}
      {def.required ? <span aria-hidden="true"> *</span> : null}
    </>
  );

  return (
    <div className="rf-field">
      {isGroup ? (
        <span className="rf-field__label" id={`${id}-label`}>{heading}</span>
      ) : (
        <label className="rf-field__label" htmlFor={id} id={`${id}-label`}>{heading}</label>
      )}
      {control}
      {def.help ? <p className="rf-field__help">{def.help}</p> : null}
      {picker ? (
        <div className="rf-field__audience">
          <label className="rf-field__audience-label" htmlFor={`${id}-vis`}>
            Who can see this
          </label>
          {/*
            "Who can see this <field>", because one form carries a picker per field and four
            controls all called "Who can see this" are four controls a screen reader user
            cannot tell apart. The visible text is a PREFIX of the accessible name rather
            than being replaced by it, which is what keeps speech input working (WCAG 2.5.3).

            Written out rather than composed with `aria-labelledby={`${id}-vis-label
            ${id}-label`}`, which reads better and is wrong: a label reference makes this
            select answer to the FIELD's label as well, so `getByLabelText('Site')` — the
            query every consumer already uses to reach the field itself — starts matching
            two controls and throws. The name is the same either way; only the association
            differs, and the picker has no business claiming the field's label.
          */}
          <select
            id={`${id}-vis`}
            aria-label={`Who can see this ${def.label}`}
            value={effective}
            onChange={(e) => onVisibilityChange!(e.target.value as FieldVisibility)}
          >
            {choices.map((v) => (
              <option key={v} value={v}>{CHOICE_LABEL[v]}</option>
            ))}
          </select>
        </div>
      ) : note ? (
        // Said plainly, per field, and tied to the control via `aria-describedby` above —
        // a registrant who cannot tell what reaches the public page either withholds
        // everything or publishes something they meant to keep back, and a screen reader
        // user gets no hint at all from an unassociated paragraph.
        <p className="rf-field__visibility" id={`${id}-vis`}>{note}</p>
      ) : null}
      {error ? <p className="rf-field__error" id={`${id}-err`} role="alert">{error}</p> : null}
    </div>
  );
}
