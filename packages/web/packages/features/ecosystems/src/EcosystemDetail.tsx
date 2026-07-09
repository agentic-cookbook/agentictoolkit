"use client";

import { useId } from "react";
import { Card, CardContent } from "@agentic-toolkit/ui/components/card";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Label } from "@agentic-toolkit/ui/components/label";
import { Textarea } from "@agentic-toolkit/ui/components/textarea";
import { RdidEditor } from "@agentic-toolkit/ui/components/rdid-editor";
import { validateLeaf } from "@agentic-toolkit/ui/lib/rdid";
import { DetailSection } from "@agentic-toolkit/resource";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import type { Ecosystem, EcosystemInput } from "@agentic-toolkit/data/ecosystems";

export function ecoBlank(): EcosystemInput {
  return { identifier: "", name: "", description: "", region: "", domain: "" };
}

export function ecoToInput(e: Ecosystem): EcosystemInput {
  return {
    identifier: e.identifier,
    name: e.name,
    description: e.description,
    region: e.region,
    domain: e.domain,
  };
}

export function ecoDiffers(a: EcosystemInput, b: EcosystemInput): boolean {
  return (Object.keys(a) as (keyof EcosystemInput)[]).some(
    (k) => a[k].trim() !== b[k].trim(),
  );
}

export function ecoNormalize(d: EcosystemInput): EcosystemInput {
  return {
    identifier: d.identifier.trim(),
    name: d.name.trim(),
    description: d.description.trim(),
    region: d.region.trim(),
    domain: d.domain.trim(),
  };
}

/** Returns an error message, or null when the draft is valid. */
export function ecoValidate(draft: EcosystemInput, takenIdentifiers: string[]): string | null {
  const id = draft.identifier.trim();
  if (!id) return "Identifier is required.";
  if (!id.startsWith("ecosystem.") || validateLeaf(id.slice("ecosystem.".length)) !== null)
    return "Identifier must be ecosystem.<name>, e.g. ecosystem.my-ecosystem";
  if (takenIdentifiers.includes(id)) return `Identifier "${id}" is already in use.`;
  if (!draft.name.trim()) return "Name is required.";
  return null;
}

/**
 * Controlled ecosystem form — fields only. Save/Cancel/Delete live in the
 * MasterDetailLayout button bar; the pane owns the draft + dirty/validity state.
 */
export function EcosystemDetail({
  title,
  draft,
  onChange,
  error,
  identifierLocked = false,
}: {
  /** When omitted, the form renders without the section heading (e.g. the
   * single-ecosystem Settings editor, which has no "ECOSYSTEM" header). */
  title?: string;
  draft: EcosystemInput;
  onChange: (next: EcosystemInput) => void;
  error?: string | null;
  /** Lock the identifier when editing a saved ecosystem — it's the immutable
   * rdid and update() ignores it, so an editable field would mislead. */
  identifierLocked?: boolean;
}) {
  // Unique per instance: the create dialog mounts a second EcosystemDetail over
  // the Settings pane's, so fixed ids would collide and break the <label for> links.
  const uid = useId();

  function set<K extends keyof EcosystemInput>(key: K, value: string) {
    onChange({ ...draft, [key]: value });
  }

  const card = (
      <Card>
        <CardContent className="flex flex-col gap-5">
          <RdidEditor
            id={`${uid}-identifier`}
            label="Identifier"
            prefix="ecosystem."
            value={draft.identifier.startsWith("ecosystem.") ? draft.identifier.slice("ecosystem.".length) : draft.identifier}
            placeholder="my-ecosystem"
            hint={identifierLocked ? "Fixed once created." : "Only the name is editable — the ecosystem. type is fixed."}
            disabled={identifierLocked}
            onChange={(leaf) => set("identifier", "ecosystem." + leaf)}
          />
          <Field
            id={`${uid}-name`}
            label="Name"
            hint="Display name."
            placeholder="My Ecosystem"
            value={draft.name}
            onChange={(v) => set("name", v)}
          />
          <div className="flex flex-col gap-2">
            <Label htmlFor={`${uid}-description`}>Description</Label>
            <Textarea
              id={`${uid}-description`}
              rows={3}
              placeholder="What this ecosystem is for."
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <Field
            id={`${uid}-region`}
            label="Geographical region"
            hint="Optional — defaults to none."
            placeholder="none"
            value={draft.region}
            onChange={(v) => set("region", v)}
          />
          <Field
            id={`${uid}-domain`}
            label="Domain"
            placeholder="myecosystem.com"
            value={draft.domain}
            onChange={(v) => set("domain", v)}
          />

          <ErrorText error={error} />
        </CardContent>
      </Card>
  );

  return title ? <DetailSection title={title}>{card}</DetailSection> : card;
}

function Field({
  id,
  label,
  hint,
  placeholder,
  value,
  onChange,
  disabled = false,
}: {
  id: string;
  label: string;
  hint?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <p className="text-xs text-apt-text-muted">{hint}</p>}
    </div>
  );
}
