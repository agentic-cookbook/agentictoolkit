"use client";

import { Trash2 } from "lucide-react";

import { Field, FieldGroup } from "@agentic-toolkit/ui/blocks";
import { Badge } from "@agentic-toolkit/ui/components/badge";
import { EmptyState } from "@agentic-toolkit/ui/components/empty-state";
import { List, ListItem } from "@agentic-toolkit/ui/components/list";
import { Button } from "@agentic-toolkit/ui/components/button";
import { Input } from "@agentic-toolkit/ui/components/input";
import { Select } from "@agentic-toolkit/ui/components/select";
import { buildAvailableTypes, TYPE_SCHEMAS, type AvailableType } from "./available-types";
import { type SchemaTable, newSchemaTable, slugifyTableName } from "./schema-model";

const AVAILABLE = buildAvailableTypes();
const TYPE_BY_ID = new Map(AVAILABLE.map((t) => [t.id, t]));
// Available types grouped by schema, in display order — drives both the
// "Add a type" picker and each row's <Select>.
const BY_SCHEMA: Array<{ schema: string; types: AvailableType[] }> = TYPE_SCHEMAS.map(
  (schema) => ({ schema, types: AVAILABLE.filter((t) => t.schema === schema) }),
);

/** Default row name for a type: its bare table name, slugified. */
function nameForType(typeId: string): string {
  return slugifyTableName(TYPE_BY_ID.get(typeId)?.table ?? "");
}

function TypeOptions() {
  return (
    <>
      {BY_SCHEMA.map(({ schema, types }) => (
        <optgroup key={schema} label={schema}>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label} ({t.table})
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

/**
 * Editor for the STRUCTURE of a bucket's tables: add/remove rows, edit each
 * table's name (slug) and type (sql-table picker). No permissions here — that's
 * the access list's concern (the Access topic). Pure controlled component over a
 * SchemaTable[].
 *
 * Adding: pick a type from the "Add a type…" select (name pre-filled), or "Add
 * all" to add every catalogue type not already present; "Remove all" clears the
 * list. Individual rows stay removable via the trash button.
 */
export function SchemaTablesEditor({
  tables,
  onChange,
}: {
  tables: SchemaTable[];
  onChange: (next: SchemaTable[]) => void;
}) {
  const presentTypeIds = new Set(tables.map((t) => t.type));
  const allPresent = AVAILABLE.every((t) => presentTypeIds.has(t.id));

  function addType(typeId: string) {
    onChange([...tables, newSchemaTable(typeId, nameForType(typeId))]);
  }

  function addAll() {
    const additions = AVAILABLE.filter((t) => !presentTypeIds.has(t.id)).map((t) =>
      newSchemaTable(t.id, nameForType(t.id)),
    );
    if (additions.length > 0) onChange([...tables, ...additions]);
  }

  function updateTable(id: string, patch: Partial<SchemaTable>) {
    onChange(tables.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function removeTable(id: string) {
    onChange(tables.filter((t) => t.id !== id));
  }

  return (
    <FieldGroup
      title="Tables"
      trailing={tables.length > 0 ? <Badge variant="neutral">{tables.length}</Badge> : undefined}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="Add a type"
          value=""
          className="w-auto"
          onChange={(e) => {
            if (e.target.value) addType(e.target.value);
          }}
        >
          <option value="">+ Add a type…</option>
          <TypeOptions />
        </Select>
        <Button type="button" variant="outline" size="sm" onClick={addAll} disabled={allPresent}>
          Add all
        </Button>
        {tables.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange([])}
            className="text-apt-red hover:text-apt-red"
          >
            Remove all
          </Button>
        )}
      </div>

      {tables.length === 0 ? (
        <EmptyState
          title="No tables yet."
          description="Add one to describe what this bucket contains."
        />
      ) : (
        <List>
          {tables.map((table) => (
            <ListItem
              key={table.id}
              className="flex-col items-stretch gap-3 py-3 sm:flex-row sm:items-end"
            >
              <Field label="Name" className="sm:flex-1">
                <Input
                  value={table.name}
                  placeholder="contacts"
                  onChange={(e) =>
                    updateTable(table.id, { name: slugifyTableName(e.target.value) })
                  }
                />
              </Field>
              <Field label="Type (sql-table)" className="sm:flex-1">
                <Select
                  value={table.type}
                  onChange={(e) => updateTable(table.id, { type: e.target.value })}
                >
                  {/* A persisted type the curated catalogue no longer lists still
                      shows its real value, not a silently-mismatched first option. */}
                  {!TYPE_BY_ID.has(table.type) && (
                    <option value={table.type}>{table.type} (unlisted)</option>
                  )}
                  <TypeOptions />
                </Select>
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeTable(table.id)}
                title="Remove table"
                aria-label={`Remove ${table.name || "table"}`}
              >
                <Trash2 className="text-apt-red" />
              </Button>
            </ListItem>
          ))}
        </List>
      )}
    </FieldGroup>
  );
}
