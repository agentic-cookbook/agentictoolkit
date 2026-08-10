"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@agentic-toolkit/ui/components/button";
import { Select } from "@agentic-toolkit/ui/components/select";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import { schemasApi } from "@agentic-toolkit/data/markdown";
import type { SchemaDefinition } from "../schemas/schema-model";
import { DetailSection } from "@agentic-toolkit/resource";
import { SchemaGrantNode } from "./SchemaGrantNode";
import { type SchemaGrant, newSchemaGrant } from "./permission-model";

/**
 * The application's "Schema Permissions" section: add schemas defined in the
 * top-level Schemas feature and set permissions on each. Structure is owned by
 * the Schemas feature; here we only grant + permission.
 */
export function SchemaPermissionsSection({
  grants,
  onChange,
}: {
  grants: SchemaGrant[];
  onChange: (next: SchemaGrant[]) => void;
}) {
  const [definitions, setDefinitions] = useState<SchemaDefinition[] | null>(null);
  const [picking, setPicking] = useState(false);
  const [pick, setPick] = useState("");

  useEffect(() => {
    void schemasApi.list().then(setDefinitions);
  }, []);

  const defsById = new Map((definitions ?? []).map((d) => [d.id, d]));
  const grantedIds = new Set(grants.map((g) => g.schemaId));
  const addable = (definitions ?? []).filter((d) => !grantedIds.has(d.id));

  function addGrant(schemaId: string) {
    if (!schemaId || grantedIds.has(schemaId)) return;
    onChange([...grants, newSchemaGrant(schemaId)]);
    setPicking(false);
    setPick("");
  }

  function updateGrant(next: SchemaGrant) {
    onChange(grants.map((g) => (g.schemaId === next.schemaId ? next : g)));
  }

  function removeGrant(schemaId: string) {
    onChange(grants.filter((g) => g.schemaId !== schemaId));
  }

  return (
    <DetailSection
      title="Schema Permissions"
      action={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setPicking((v) => !v)}
          disabled={definitions !== null && addable.length === 0}
        >
          <Plus data-icon="inline-start" />
          Add schema
        </Button>
      }
    >
      {picking && (
        <div className="flex items-center gap-2">
          <Select value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Select a schema…</option>
            {addable.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.tables.length} table{d.tables.length === 1 ? "" : "s"})
              </option>
            ))}
          </Select>
          <Button type="button" onClick={() => addGrant(pick)} disabled={!pick}>
            Add
          </Button>
        </div>
      )}

      {definitions !== null && addable.length === 0 && grants.length === 0 && (
        <p className="text-sm text-apt-text-muted">
          No schemas defined yet. Create one in the Schemas section first.
        </p>
      )}

      {grants.length === 0 ? (
        <EmptyState
          className="min-h-0 px-3 py-6"
          title="No schemas granted."
          description="Add one to give this application access to its tables."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {grants.map((grant) => (
            <SchemaGrantNode
              key={grant.schemaId}
              grant={grant}
              definition={defsById.get(grant.schemaId) ?? null}
              onChange={updateGrant}
              onRemove={() => removeGrant(grant.schemaId)}
            />
          ))}
        </div>
      )}
    </DetailSection>
  );
}
