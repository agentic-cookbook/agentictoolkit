"use client";

import { Disclosure } from "@agenticdevelopertoolkit/ui/components/disclosure";
import { Label } from "@agenticdevelopertoolkit/ui/components/label";
import { findAvailableType } from "../schemas/available-types";
import type { SchemaTable } from "../schemas/schema-model";
import { EmptyState } from "@agenticdevelopertoolkit/ui/components/empty-state";
import { PermissionToggles } from "@agenticdevelopertoolkit/ui/components/permission-toggles";
import {
  type Crud,
  type PermissionLevel,
  type TableGrant,
  clampToParent,
} from "./permission-model";

/**
 * Permission editor for ONE table within a granted schema. The table's
 * structure (name, type) comes from the schema definition and is shown
 * read-only; only the permission level + CRUD are editable here, clamped to the
 * schema-level ceiling. Row level shows the "coming soon" placeholder.
 */
export function TablePermissionNode({
  table,
  grant,
  schemaPermissions,
  onChange,
}: {
  /** Structure from the schema definition (read-only here). */
  table: SchemaTable;
  /** This table's permission decision. */
  grant: TableGrant;
  /** Schema-level CRUD — ceiling for this table. */
  schemaPermissions: Crud;
  onChange: (next: TableGrant) => void;
}) {
  const typeInfo = findAvailableType(table.type);

  function setLevel(level: PermissionLevel) {
    onChange({ ...grant, level });
  }

  function setPermissions(next: Crud) {
    onChange({ ...grant, permissions: clampToParent(next, schemaPermissions) });
  }

  return (
    <Disclosure
      className="bg-apt-bg"
      title={table.name || "untitled_table"}
      subtitle={typeInfo ? typeInfo.id : table.type}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label>Permission level</Label>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-apt-text">
              <input
                type="radio"
                name={`level-${table.id}`}
                checked={grant.level === "table"}
                onChange={() => setLevel("table")}
                className="accent-apt-gold"
              />
              Table
            </label>
            <label className="flex items-center gap-2 text-sm text-apt-text">
              <input
                type="radio"
                name={`level-${table.id}`}
                checked={grant.level === "row"}
                onChange={() => setLevel("row")}
                className="accent-apt-gold"
              />
              Row
            </label>
          </div>
          <p className="text-xs text-apt-text-muted">
            {grant.level === "table"
              ? "These permissions apply to every row in the table."
              : "Each row defaults to no access; permissions are granted per row."}
          </p>
        </div>

        {grant.level === "table" ? (
          <div className="flex items-center justify-between gap-3">
            <Label>Table permissions</Label>
            <PermissionToggles
              value={grant.permissions}
              parent={schemaPermissions}
              onChange={setPermissions}
            />
          </div>
        ) : (
          <EmptyState
            className="min-h-0 py-4"
            title={
              <>
                Per-row permissions — <span className="text-apt-text">Coming soon</span>
              </>
            }
          />
        )}
      </div>
    </Disclosure>
  );
}
