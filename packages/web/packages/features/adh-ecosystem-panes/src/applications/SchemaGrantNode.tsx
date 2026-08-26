"use client";

import { Trash2 } from "lucide-react";

import { Button } from "@agenticdevelopertoolkit/ui/components/button";
import { Disclosure } from "@agenticdevelopertoolkit/ui/components/disclosure";
import { Label } from "@agenticdevelopertoolkit/ui/components/label";
import type { SchemaDefinition } from "../schemas/schema-model";
import { EmptyState } from "@agenticdevelopertoolkit/ui/components/empty-state";
import { PermissionToggles } from "@agenticdevelopertoolkit/ui/components/permission-toggles";
import { TablePermissionNode } from "./TablePermissionNode";
import {
  type Crud,
  type SchemaGrant,
  type TableGrant,
  clampToParent,
  tableGrantFor,
} from "./permission-model";

/**
 * One granted schema on an application: a disclosable node showing the schema's
 * contents (from its definition, read-only) with permission controls layered
 * on. Schema-level CRUD is the ceiling; changing it re-clamps every stored
 * table grant so none can exceed the new ceiling.
 */
export function SchemaGrantNode({
  grant,
  definition,
  onChange,
  onRemove,
}: {
  grant: SchemaGrant;
  /** The resolved schema definition, or null if it was deleted. */
  definition: SchemaDefinition | null;
  onChange: (next: SchemaGrant) => void;
  onRemove: () => void;
}) {
  function setSchemaPermissions(next: Crud) {
    // Re-clamp all stored table grants to the new ceiling.
    const tables: Record<string, TableGrant> = {};
    for (const [id, tg] of Object.entries(grant.tables)) {
      tables[id] = { ...tg, permissions: clampToParent(tg.permissions, next) };
    }
    onChange({ ...grant, permissions: next, tables });
  }

  function setTableGrant(tableId: string, next: TableGrant) {
    onChange({ ...grant, tables: { ...grant.tables, [tableId]: next } });
  }

  if (!definition) {
    return (
      <Disclosure
        className="bg-apt-bg"
        title="(deleted schema)"
        subtitle={grant.schemaId}
        actions={
          <Button
            type="button"
            variant="destructive-ghost"
            size="icon-sm"
            onClick={onRemove}
            title="Remove"
          >
            <Trash2 />
          </Button>
        }
      >
        <p className="text-sm text-apt-text-muted">
          This schema no longer exists. Remove the grant, or recreate the schema in the Schemas
          section.
        </p>
      </Disclosure>
    );
  }

  return (
    <Disclosure
      defaultOpen
      title={definition.name}
      subtitle={`${definition.tables.length} table${definition.tables.length === 1 ? "" : "s"}`}
      actions={
        <>
          <PermissionToggles value={grant.permissions} onChange={setSchemaPermissions} />
          <Button
            type="button"
            variant="destructive-ghost"
            size="icon-sm"
            onClick={onRemove}
            title="Remove schema"
          >
            <Trash2 />
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs text-apt-text-muted">
          Schema permissions are the ceiling — no table can exceed them. Structure is defined in the
          Schemas section.
        </p>

        {definition.tables.length === 0 ? (
          <EmptyState className="min-h-0 py-4" title="This schema has no tables." />
        ) : (
          <div className="flex flex-col gap-3">
            <Label>Tables</Label>
            {definition.tables.map((table) => (
              <TablePermissionNode
                key={table.id}
                table={table}
                grant={tableGrantFor(grant, table.id)}
                schemaPermissions={grant.permissions}
                onChange={(next) => setTableGrant(table.id, next)}
              />
            ))}
          </div>
        )}
      </div>
    </Disclosure>
  );
}
