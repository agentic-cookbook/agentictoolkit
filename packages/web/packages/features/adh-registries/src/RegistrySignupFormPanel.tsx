'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { FieldVisibility, SectionRow } from '@agentic-toolkit/registry/client';
// The hub does not depend on @agenticdevelopertoolkit/registry-types directly —
// evaluateShowIf crosses through the registry package's own re-export, the same path
// EntryEditor.tsx already uses for the registrant-facing side of the same rule.
import { evaluateShowIf } from '@agentic-toolkit/registry/types';
import { Field, FieldGroup, SplitViewControl, useSplitView } from '@agenticdevelopertoolkit/ui/blocks';
import { Button } from '@agenticdevelopertoolkit/ui/components/button';
import { Input } from '@agenticdevelopertoolkit/ui/components/input';
import { EntrySectionPanel } from './EntrySectionPanel';
import { RegistrySectionPanel } from './RegistrySectionPanel';
import type { RegistryDraftState, UseRegistryDraft } from './useRegistryDraft';

export interface RegistrySignupFormPanelProps {
  /** The topic's own title, from the explorer's `titleFor`. */
  title: string;
  editor: UseRegistryDraft;
  draft: RegistryDraftState;
}

export function RegistrySignupFormPanel({ title, editor, draft }: RegistrySignupFormPanelProps) {
  // `null` is "not adding", `''` is "adding, nothing typed yet" — the same two-state control
  // the old section rail carried, and then the Details pane, following the sections here.
  const [newSection, setNewSection] = useState<string | null>(null);

  // Answers nobody gave, discarded when the pane unmounts. Shared across EVERY section rather
  // than held per section, which is what makes a `show_if` rule that names a field in another
  // section preview correctly — the registrant fills in one form, not N independent ones.
  const [values, setValues] = useState<Record<string, unknown>>({});
  // Throwaway for the same reason, and here at all for one: the audience picker is the part of
  // the registrant's form the owner's own choices decide. A preview that dropped it would hide
  // from the owner exactly what their `visibility` ceiling does to the form they are building.
  const [valueVisibility, setValueVisibility] = useState<Record<string, FieldVisibility>>({});

  // The same control the markdown document editor carries, from the same block — the owner is
  // building a form here and writing a note there, but "one pane at a time, or both" is one
  // behaviour, so there is one of it.
  const view = useSplitView();

  const sections = [...draft.sections].sort((a, b) => a.sortOrder - b.sortOrder);

  const createSection = async () => {
    if (newSection === null) return;
    // Only closed on success: a rejected create (a duplicate key, a 403) leaves the box open
    // with what was typed still in it, next to the alert saying why, so the owner can fix the
    // name rather than retype it.
    if (await editor.createSection(newSection)) setNewSection(null);
  };

  return (
    <FieldGroup title={title}>
      {/* Below the header rather than inside it: a view chooser is not a header action, it
          belongs to the body it switches, so it reads left-to-right above the panes. */}
      <SplitViewControl view={view} subject="Form" />

      <div id={view.panesId} className="flex min-w-0 flex-col gap-6 lg:flex-row lg:gap-8">
        {view.showEditor ? (
          <div className="flex min-w-0 flex-1 flex-col gap-6">
            {sections.map((section) => (
              <RegistrySectionPanel
                key={section.id}
                section={section}
                editor={editor}
                draft={draft}
              />
            ))}

            {/*
              Creating a section is a WRITE that happens on the spot, not part of the draft the
              Save button commits — it has to exist server-side before a field can name it. That
              is why it sits below the sections with its own button rather than among them.
            */}
            {newSection === null ? (
              <Button
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() => setNewSection('')}
              >
                <Plus data-icon="inline-start" />
                Add section
              </Button>
            ) : (
              <div className="flex items-end gap-2">
                <Field label="Section name" className="flex-1">
                  <Input value={newSection} onChange={(e) => setNewSection(e.target.value)} />
                </Field>
                <Button size="sm" onClick={() => void createSection()}>Create section</Button>
              </div>
            )}
          </div>
        ) : null}

        {view.showPreview ? (
          <div className="flex min-w-0 flex-1 flex-col gap-6 rounded-md border border-apt-border p-4">
            {sections.length === 0 ? (
              <p className="text-sm text-apt-text-dim">
                Nothing to fill in yet — add a section and its fields on the left.
              </p>
            ) : null}
            {sections.map((section) => (
              <PreviewSection
                key={section.id}
                section={section}
                draft={draft}
                values={values}
                valueVisibility={valueVisibility}
                onChange={(key, value) => setValues((v) => ({ ...v, [key]: value }))}
                onVisibilityChange={(key, visibility) =>
                  setValueVisibility((v) => ({ ...v, [key]: visibility }))
                }
              />
            ))}
          </div>
        ) : null}
      </div>
    </FieldGroup>
  );
}

/**
 * One section as the registrant will meet it. `EntrySectionPanel` renders no heading of its
 * own — both of its hosts name the section above it — so the preview supplies one here.
 */
function PreviewSection({
  section, draft, values, valueVisibility, onChange, onVisibilityChange,
}: {
  section: SectionRow;
  draft: RegistryDraftState;
  values: Record<string, unknown>;
  valueVisibility: Record<string, FieldVisibility>;
  onChange: (key: string, value: unknown) => void;
  onVisibilityChange: (key: string, visibility: FieldVisibility) => void;
}) {
  const fields = draft.fields.filter((f) => f.sectionId === section.id);
  return (
    <FieldGroup title={section.label || section.key}>
      <EntrySectionPanel
        section={section}
        // A preview row needs an `id` the registrant-facing panel can key on, and an unsaved
        // field has none yet — hence the positional stand-in. `sortOrder` is re-derived from
        // position for the same reason the save does it: the draft's own `sortOrder` is
        // whatever the server last said, not where the row now sits.
        //
        // The KEY gets the same stand-in, because `EntrySectionPanel` files every answer under
        // `def.key` and a field the owner has not labelled yet still has `''`. Two of those in a
        // form shared one entry in `values`, so typing in either preview box filled in both — the
        // owner's own preview reporting a collision the real form will never have, since the save
        // bar refuses a blank key long before a registrant sees it. Preview-only: nothing here is
        // written anywhere, and the moment the field is labelled it previews under its real key.
        defs={fields
          .map((f, index) => {
            const standIn = `preview-${section.id}-${index}`;
            return { ...f, id: f.id ?? standIn, key: f.key || standIn, sortOrder: index };
          })
          .filter((def) => evaluateShowIf(def, values))}
        values={values}
        valueVisibility={valueVisibility}
        errors={{}}
        onChange={onChange}
        onVisibilityChange={onVisibilityChange}
      />
    </FieldGroup>
  );
}
