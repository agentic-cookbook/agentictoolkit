"""Shared `resolve_spec` for this package's generators (gen_endpoints.py,
gen_table_metadata.py, gen_schema.py) — extracted because it used to be a
byte-equivalent ~30-line function, docstring included, copy-pasted into each
one. Edit here; every generator picks up the fix at import time.

pnpm always invokes these scripts as `python3 tools/<script>.py`, so `tools/`
is `sys.path[0]` (Python inserts the invoked script's own directory, not the
cwd) and `import _spec_input` resolves with no path manipulation needed.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


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
            "python3 tools/<this-script>.py"
        )
    spec = Path(raw).expanduser().resolve()
    if not spec.is_file():
        raise SystemExit(f"spec not found: {spec}")
    return spec
