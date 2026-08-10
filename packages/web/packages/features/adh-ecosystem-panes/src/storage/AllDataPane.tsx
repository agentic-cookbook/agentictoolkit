"use client";

import { useState } from "react";
import { CrudDataBrowser, type CrudShell } from "@agentic-toolkit/crud";

/**
 * All Data as a member of an ecosystem's Storage rail: the cross-schema CRUD browser over every
 * bucket-backed table.
 *
 * Selection is LOCAL (component state), not URL-driven, and that is the point of this component
 * rather than a bare `<CrudDataBrowser basePath=…/>`. The enclosing ecosystem URL scheme cedes
 * exactly ONE deep segment to a group member, and the browser needs two (schema ▸ table) — so
 * driving it by URL pushes the standalone all-data route and unmounts the rail the user is
 * standing in. The schema/table rails still publish into the host's merged stack (via `shell`),
 * so a click re-renders in place and the trail stays intact.
 *
 * `shell` is the host's stack adapter. Omit it and the browser uses the crud package's own
 * DefaultCrudShell — correct for a host with no rail chrome of its own to publish into.
 */
export function AllDataPane({ shell }: { shell?: CrudShell }) {
  const [schema, setSchema] = useState<string | null>(null);
  const [table, setTable] = useState<string | null>(null);
  return (
    <CrudDataBrowser
      shell={shell}
      selection={{
        schema,
        table,
        // Changing or clearing the schema resets the table (a different schema has different tables).
        onSelectSchema: (s) => {
          setSchema(s);
          setTable(null);
        },
        onSelectTable: setTable,
      }}
    />
  );
}
