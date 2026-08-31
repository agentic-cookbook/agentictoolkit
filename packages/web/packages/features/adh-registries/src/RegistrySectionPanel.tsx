'use client';

import { Plus } from 'lucide-react';
import type { SectionRow } from '@agentic-toolkit/registry/client';
import { FieldGroup } from '@agenticdevelopertoolkit/ui/blocks';
import { Button } from '@agenticdevelopertoolkit/ui/components/button';
import { RegistryFieldPanel } from './RegistryFieldPanel';
import type { RegistryDraftState, UseRegistryDraft } from './useRegistryDraft';

export interface RegistrySectionPanelProps {
  section: SectionRow;
  editor: UseRegistryDraft;
  draft: RegistryDraftState;
}

/**
 * One section of the signup form, as the owner designs it: its field defs in order, and a
 * way to add another.
 *
 * EDIT side only. The preview used to live here, per section, behind a toggle of its own —
 * which meant the owner could see one section's rendering at a time and never the form as a
 * whole, and meant a `show_if` rule pointing at a field in a NEIGHBOURING section previewed
 * against answers this pane could not hold. `RegistrySignupFormPanel` owns the preview now,
 * over every section at once and over one shared set of answers.
 */
export function RegistrySectionPanel({ section, editor, draft }: RegistrySectionPanelProps) {
  const fields = draft.fields.filter((f) => f.sectionId === section.id);

  return (
    <FieldGroup title={section.label || section.key}>
      {section.description ? (
        <p className="text-sm text-apt-text-dim">{section.description}</p>
      ) : null}

      {fields.map((field, index) => (
        <RegistryFieldPanel
          key={field.clientKey}
          def={field}
          siblings={fields.map((s) => ({ key: s.key, label: s.label, type: s.type }))}
          onChange={(next) => editor.setField(field, next)}
          onDelete={() => void editor.deleteField(field)}
          onMoveUp={() => editor.moveField(field, -1)}
          onMoveDown={() => editor.moveField(field, 1)}
          canMoveUp={index > 0}
          canMoveDown={index < fields.length - 1}
        />
      ))}

      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={() => editor.addField(section.id)}
      >
        <Plus data-icon="inline-start" />
        Add field
      </Button>
    </FieldGroup>
  );
}
