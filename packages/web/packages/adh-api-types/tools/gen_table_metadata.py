#!/usr/bin/env python3
"""Generate @agentic-toolkit/crud's src/generated/table-metadata.ts from the OpenAPI spec.

The backend's generic CRUD subsystem exposes every non-excluded table at
/<schema-kebab>/<table-kebab> (GET list / POST create) plus an item path
(GET / PUT / DELETE). The dumped spec (frontend/src/sites/api/openapi.json) carries
the full JSON Schema for each table's rows and create body, so it is the single
authoritative source for what the CRUD UI may edit — this script just projects
it into a compact runtime module.

A table is recognised as generic CRUD only on the FULL signature — collection
path with get+post AND exactly one all-path-param descendant with
get+put+delete. Hand-written routes that share the URL shape (e.g.
/persona/services, whose item path uses PATCH) don't match and are skipped.

Deterministic output (sorted by table key) so reruns are diff-stable; CI's
metadata drift test cross-checks the committed module against the spec.
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path
from typing import Any

PACKAGE_DIR = Path(__file__).resolve().parents[1]
#  This package now lives INSIDE agentictoolkit, so the package it writes into
#  (@agentic-toolkit/crud, which owns the runtime half) is a sibling. No
#  repo-crossing walk any more.
TOOLKIT_PACKAGES = PACKAGE_DIR.parent
OUT_PATH = TOOLKIT_PACKAGES / "crud" / "src" / "generated" / "table-metadata.ts"


def resolve_spec(argv: list[str] | None = None) -> Path:
    """Locate adh's OpenAPI spec, which is an INPUT — never a computed path.

    The spec belongs to adh. This repo is consumed standalone by repos that have
    no openapi.json at all, so there is no relative location this file could
    honestly derive. It used to derive one (`parents[1].parent.parent` back when
    the package sat at `frontend/src/app/api-types`), and when the package moved
    into the toolkit that walk silently retargeted to a directory that does not
    exist — the same stale-path break this move exposed in four other tools. An
    explicit input either resolves or says why it didn't.
    """
    args = sys.argv[1:] if argv is None else argv
    # pnpm forwards the `--` separator through to the script, so a documented
    # `pnpm --filter … <script> -- <spec>` invocation arrives here as ['--', '<spec>']
    # and the separator gets read as the path. Drop one leading `--`.
    if args and args[0] == "--":
        args = args[1:]
    raw = args[0] if args else os.environ.get("ADH_OPENAPI_SPEC")
    if not raw:
        raise SystemExit(
            "no OpenAPI spec given. This generator reads adh's committed spec, "
            "which does not live in this repo. Pass it as the first argument or "
            "set ADH_OPENAPI_SPEC:\n"
            "  ADH_OPENAPI_SPEC=<adh>/frontend/src/sites/api/openapi.json "
            "python3 tools/gen_table_metadata.py"
        )
    spec = Path(raw).expanduser().resolve()
    if not spec.is_file():
        raise SystemExit(f"spec not found: {spec}")
    return spec

# Only the schemas the hub's feature routes edit — keeps the module (which
# ships to the browser) bounded. Extend deliberately, not automatically.
# Single source of truth, shared with src/__tests__/metadata.test.ts (the drift
# gate) so the two can never disagree — edit allowed-schemas.json, not a literal.
ALLOWED_SCHEMAS = set(json.loads((PACKAGE_DIR / "allowed-schemas.json").read_text()))

# Collection base paths whose URL shape matches the generic-CRUD signature
# (get+post here, one item path with get+put+delete) but which are NOT generic
# CRUD — they are hand-written routes the backend explicitly excludes from generic
# CRUD (src/crud/policy.ts). content.markdown is append-only versioned storage
# served by a tuned REST surface; projecting it as an editable table would let the
# hub's generic editor corrupt its version history. Most hand-written routes
# (e.g. /persona/services, item path uses PATCH) don't match the signature and
# need no entry — list one here only when it would otherwise be a false positive.
HAND_WRITTEN_BASES = {
    "/content/markdown",
    # discussion.topics / discussion.posts are hand-written (src/routes/discussion.ts):
    # a topic is born atomically WITH its opening post + a versioned markdown body doc,
    # replies compute a per-topic post_number, and edit/pin/lock/delete carry bespoke
    # author/admin authorization. Projecting them as generic editable tables would let the
    # hub's generic editor create orphans and bypass that authorization, so exclude both
    # even though their URL shape now matches the CRUD signature (get+post + get/put/delete).
    "/discussion/topics",
    "/discussion/posts",
    # persona provider templates are hand-written (src/routes/providerTemplates.ts):
    # public reads, an enveloped {items,total,...} list (not a bare array), a nested
    # `models` set synced declaratively by PUT, and a /verify probe sub-route. Its URL
    # shape matches the CRUD signature, but projecting it would emit a zero-column
    # (the enveloped list hides the row schema) pseudo-table in the hub editor.
    "/persona/provider-templates",
}

BASE_PATH_RE = re.compile(r"^/([a-z-]+)/([a-z-]+)$")
PARAM_RE = re.compile(r"\{([a-zA-Z0-9_]+)\}")

# The authorization tiers the backend documents on each CRUD collection path
# (`x-exposure`, emitted by src/openapi/build.ts from the same TABLE_EXPOSURE map
# the runtime gate reads). The browser presents the surface the viewer may
# actually use instead of letting them discover it as a 403 — see
# CrudDataBrowser/CrudDataView. NOT a security boundary: the server-side gate is.
EXPOSURE_TIERS = {"owner", "catalog", "admin"}

HEADER = """\
// GENERATED by @agentic-toolkit/adh-api-types tools/gen_table_metadata.py — do not
// edit by hand. Source: adh's frontend/src/sites/api/openapi.json, which is NOT in
// this repo — the spec is an explicit input, so regenerate with a path to an adh
// checkout:
//   pnpm --filter @agentic-toolkit/adh-api-types gen:crud-metadata -- <adh>/frontend/src/sites/api/openapi.json
import type { CrudTableMeta } from '../types'

export const CRUD_TABLES: Record<string, CrudTableMeta> = {
"""


def json_schema_for(operation: dict[str, Any], *path: str) -> dict[str, Any]:
    node: Any = operation
    for key in path:
        node = node.get(key)
        if node is None:
            return {}
    return node if isinstance(node, dict) else {}


def column_shape(prop: dict[str, Any]) -> tuple[str, bool, list[str] | None, int | None]:
    """(type, nullable, enum, maxLength) for one property schema."""
    nullable = False
    variants = prop.get("anyOf")
    if isinstance(variants, list):
        non_null = [v for v in variants if v.get("type") != "null"]
        nullable = len(non_null) != len(variants)
        prop = non_null[0] if non_null else {}
    ctype = prop.get("type")
    # JSON Schema 2020-12 nullable idiom: `"type": ["string", "null"]` instead of
    # the `anyOf` form above — collapse to the single non-null type + nullable flag.
    if isinstance(ctype, list):
        non_null_types = [t for t in ctype if t != "null"]
        nullable = nullable or len(non_null_types) != len(ctype)
        ctype = non_null_types[0] if non_null_types else None
    if ctype not in {"string", "integer", "number", "boolean", "object", "array"}:
        ctype = "unknown"
    enum = prop.get("enum") if isinstance(prop.get("enum"), list) else None
    max_length = prop.get("maxLength") if isinstance(prop.get("maxLength"), int) else None
    return ctype, nullable, enum, max_length


def find_tables(paths: dict[str, Any]) -> list[dict[str, Any]]:
    tables = []
    for base, ops in paths.items():
        if base in HAND_WRITTEN_BASES:
            continue
        match = BASE_PATH_RE.match(base)
        if not match or match.group(1) not in ALLOWED_SCHEMAS:
            continue
        if "get" not in ops or "post" not in ops:
            continue
        item_re = re.compile(re.escape(base) + r"(/\{[a-zA-Z0-9_]+\})+$")
        items = [
            p
            for p, item_ops in paths.items()
            if item_re.match(p) and {"get", "put", "delete"} <= set(item_ops)
        ]
        if len(items) != 1:
            continue
        schema, table = match.groups()
        item_path = items[0]

        # Fail loudly rather than defaulting: a missing tier means the backend added a
        # CRUD table without classifying it, and guessing 'owner' would ship an
        # admin-only table to every viewer as freely browsable.
        exposure = ops.get("x-exposure")
        if exposure not in EXPOSURE_TIERS:
            raise SystemExit(
                f"{schema}/{table}: x-exposure is {exposure!r}, expected one of "
                f"{sorted(EXPOSURE_TIERS)} — classify the table in TABLE_EXPOSURE "
                "(backend src/crud/policy.ts) and rerun `pnpm openapi:dump`"
            )

        row_schema = json_schema_for(
            paths[base]["get"], "responses", "200", "content", "application/json", "schema", "items"
        )
        create_schema = json_schema_for(
            paths[base]["post"], "requestBody", "content", "application/json", "schema"
        )
        update_schema = json_schema_for(
            paths[item_path]["put"], "requestBody", "content", "application/json", "schema"
        )
        row_props: dict[str, Any] = row_schema.get("properties", {})
        create_props: dict[str, Any] = create_schema.get("properties", {})
        update_props: dict[str, Any] = update_schema.get("properties", {})
        required = set(create_schema.get("required", []))

        # CrudColumn can express create-only (createOnly) but not edit-only —
        # fail loudly rather than emit metadata that misdescribes the table.
        edit_only = sorted(set(update_props) - set(create_props))
        if edit_only:
            raise SystemExit(
                f"{schema}/{table}: column(s) accepted on update but not create: "
                f"{', '.join(edit_only)} — extend CrudColumn before regenerating"
            )

        columns = []
        for name, prop in row_props.items():
            ctype, nullable, enum, max_length = column_shape(prop)
            # Optional CrudColumn fields only when present — emitting
            # `"enum": null` would violate the `enum?: string[]` contract.
            column: dict[str, Any] = {
                "name": name,
                "type": ctype,
                "required": name in required,
                "nullable": nullable,
                "serverManaged": name not in create_props,
            }
            if enum is not None:
                column["enum"] = [str(v) for v in enum]
            if max_length is not None:
                column["maxLength"] = max_length
            # In the create body but stripped (silently) from the update body:
            # the backend's zod drops it from PUT — client-supplied rdids.
            if name in create_props and name not in update_props:
                column["createOnly"] = True
            columns.append(column)

        tables.append(
            {
                "key": f"{schema}/{table}",
                "schema": schema,
                "table": table,
                "basePath": base,
                "itemPath": item_path,
                "pkParams": PARAM_RE.findall(item_path),
                "exposure": exposure,
                "columns": columns,
            }
        )
    return sorted(tables, key=lambda t: t["key"])


def emit_table(table: dict[str, Any]) -> str:
    # JSON is valid TS, so json.dumps emits every field the dict carries —
    # a field added in find_tables can't be silently dropped by a
    # hand-maintained emit list. Columns stay one object per line for diff
    # stability; key order is the dict insertion order.
    lines = [f"  {json.dumps(table['key'])}: {{"]
    for field, value in table.items():
        if field == "columns":
            lines.append('    "columns": [')
            for col in value:
                lines.append(f"      {json.dumps(col)},")
            lines.append("    ],")
        else:
            lines.append(f"    {json.dumps(field)}: {json.dumps(value)},")
    lines.append("  },")
    return "\n".join(lines)


def main() -> None:
    spec = json.loads(resolve_spec().read_text(encoding="utf-8"))
    tables = find_tables(spec["paths"])
    if not tables:
        raise SystemExit("no generic CRUD tables found — spec layout changed?")
    body = "\n".join(emit_table(t) for t in tables)
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(HEADER + body + "\n}\n", encoding="utf-8")
    print(f"wrote {OUT_PATH.relative_to(TOOLKIT_PACKAGES)}: {len(tables)} tables")


if __name__ == "__main__":
    main()
