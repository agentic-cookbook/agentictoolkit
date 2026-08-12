"use client";

import { Field } from "@agentic-toolkit/ui/blocks";
import { Card, CardContent } from "@agentic-toolkit/ui/components/card";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Textarea } from "@agentic-toolkit/ui/components/textarea";
import { ErrorText } from "@agentic-toolkit/ui/components/error-text";
import type { SchemaDefinition, SchemaDefinitionInput } from "./schema-model";
import { DetailSection } from "@agentic-toolkit/resource";
import { SchemaTablesEditor } from "./SchemaTablesEditor";
import type { RenderTransferSection } from "../transfer-seam";

export function schemaBlank(): SchemaDefinitionInput {
  return { name: "", description: "", tables: [] };
}

export function schemaToInput(s: SchemaDefinition): SchemaDefinitionInput {
  return { name: s.name, description: s.description, tables: s.tables };
}

/** Returns an error message, or null when the draft is valid. */
export function schemaValidate(
  draft: SchemaDefinitionInput,
  takenNames: string[] = [],
): string | null {
  const name = draft.name.trim();
  if (!name) return "Name is required.";
  if (takenNames.some((n) => n.toLowerCase() === name.toLowerCase()))
    return `A bucket named "${name}" already exists.`;
  if (draft.tables.some((t) => !t.name.trim())) return "Every table needs a name.";
  // Names are unique per bucket (backend unique (bucket, name) index). Catch
  // duplicates inline — e.g. adding the same type twice pre-fills the same name —
  // rather than letting the save throw mid-create.
  const seen = new Set<string>();
  for (const t of draft.tables) {
    const key = t.name.trim().toLowerCase();
    if (seen.has(key)) return `Two tables share the name "${t.name.trim()}". Names must be unique.`;
    seen.add(key);
  }
  return null;
}

/**
 * Controlled bucket-definition form — name, description, and the tables editor.
 * Single-purpose: access lists live in their own "Access" topic (AccessPane), not
 * here. Save/Cancel/Delete live in the MasterDetailLayout button bar; the pane
 * owns the draft + dirty/validity state.
 */
export function SchemaDefinitionDetail({
  title,
  draft,
  onChange,
  error,
  schema,
  ecosystemRdid,
  renderTransfer,
}: {
  title: string;
  draft: SchemaDefinitionInput;
  onChange: (next: SchemaDefinitionInput) => void;
  error?: string | null;
  /** The saved bucket, when editing an existing one (null while creating) — carries the id
   *  (the bucket's own rdid) the transfer section below needs; the draft is structure only. */
  schema: SchemaDefinition | null;
  /**
   * The owning Product's scope, as `SchemasPane` itself received it (its `ecosystemId` prop) —
   * passed straight through to the host's transfer renderer, which is the one place that decides
   * whether it's usable as a transfer `currentTarget` (see {@link RenderTransferSection}). Not
   * named `ecosystemId` here: `schema.ecosystemId` already means something else on this file's own
   * row type (a raw uuid) — this is the PANE's scope, not the entity's own foreign key.
   */
  ecosystemRdid?: string;
  /** The host's Transfer Ownership section; omitted ⇒ the bucket offers no transfer. */
  renderTransfer?: RenderTransferSection;
}) {
  return (
    <>
      <DetailSection title={title}>
        <Card>
          <CardContent className="flex flex-col gap-5">
            <Field label="Name" hint="Unique bucket name.">
              <Input
                value={draft.name}
                placeholder="Profile Basics"
                onChange={(e) => onChange({ ...draft, name: e.target.value })}
              />
            </Field>

            <Field label="Description">
              <Textarea
                rows={2}
                placeholder="What this bucket is for."
                value={draft.description}
                onChange={(e) => onChange({ ...draft, description: e.target.value })}
              />
            </Field>

            <SchemaTablesEditor
              tables={draft.tables}
              onChange={(tables) => onChange({ ...draft, tables })}
            />

            {/* Form-level error (name OR tables) — not bound to a single field. */}
            <ErrorText error={error} />
          </CardContent>
        </Card>
      </DetailSection>

      {/* Only once the bucket is SAVED — there is nothing to transfer while still drafting one.
          `ecosystemRdid` here is the PANE's scope (see the prop doc above), not derived from
          `schema` itself — `SchemaDefinition` only carries `ecosystemId` as a raw uuid. */}
      {schema &&
        renderTransfer?.({
          entityNoun: "Storage Bucket",
          entityType: "bucket",
          entityId: schema.id,
          // `schema.id`, NOT `schema.name`: the transfer block's `entityLabel` doc says the
          // rdid where the object has one, and a bucket does — `bucket.buckets` is rdid-addressed
          // (backend `src/crud/policy.ts:1066`), so generic CRUD swaps the stored uuid for the rdid
          // in every list/read response (`src/crud/factory.ts:112-116`) and this field IS that rdid.
          // (A row with no `registry.identifiers` entry falls back to its uuid — still an address,
          // still what the confirm dialog should show, and never the display name.) Passing the
          // name made this the one caller contradicting the rule the same branch wrote.
          entityLabel: schema.id,
          ecosystemRdid,
        })}
    </>
  );
}
