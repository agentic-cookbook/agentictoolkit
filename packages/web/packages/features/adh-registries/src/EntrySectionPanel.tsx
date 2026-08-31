'use client';

import { RegistryEntryField } from './RegistryEntryField';
import type {
  FieldDefRow,
  FieldVisibility,
  SectionRow,
} from '@agentic-toolkit/registry/client';

export interface EntrySectionPanelProps {
  section: SectionRow;
  /** Already narrowed to the fields whose `show_if` rule applies, and already sorted. This
   *  panel renders exactly what it is handed — the decision about which fields are in play
   *  is made once, in the editor, so the rail's dots and the save payload cannot disagree
   *  with what is on screen. */
  defs: FieldDefRow[];
  values: Record<string, unknown>;
  /** The registrant's own per-field audience choices, keyed by field key. A key is absent
   *  when the field simply follows the owner's setting for it. */
  valueVisibility: Record<string, FieldVisibility>;
  errors: Record<string, string>;
  onChange: (key: string, value: unknown) => void;
  onVisibilityChange: (key: string, visibility: FieldVisibility) => void;
}

export function EntrySectionPanel({
  section,
  defs,
  values,
  valueVisibility,
  errors,
  onChange,
  onVisibilityChange,
}: EntrySectionPanelProps) {
  return (
    <div className="flex flex-col gap-5">
      {/* No heading here: both hosts already name the section above this pane — the rail's
          own topic row in the entry editor, the FieldGroup title in the owner's preview — and
          a third copy of the same words is chrome, not orientation. */}
      {section.description ? (
        <p className="text-sm text-apt-text-dim">{section.description}</p>
      ) : null}

      {defs.length === 0 ? (
        // Not an error, and not empty state either: every field here is behind a rule the
        // current answers do not satisfy. Saying so beats a blank pane that reads as broken.
        <p className="text-sm text-apt-text-dim">
          Nothing to fill in here yet — your other answers decide what appears.
        </p>
      ) : null}

      {defs.map((def) => (
        /*
          No private-field note rendered here: RegistryEntryField renders it itself, tied to
          the control's id via aria-describedby (space-joined with the error id when both
          apply) — an association only possible inside that component, which mints the id
          with useId(). A copy rendered here would be an unassociated duplicate.
        */
        <RegistryEntryField
          key={def.id}
          def={def}
          value={values[def.key]}
          error={errors[def.key] ?? null}
          onChange={(value) => onChange(def.key, value)}
          visibility={valueVisibility[def.key]}
          onVisibilityChange={(visibility) => onVisibilityChange(def.key, visibility)}
        />
      ))}
    </div>
  );
}
