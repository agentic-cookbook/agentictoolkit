#!/usr/bin/env python3
"""Generate src/schema.ts from adh's OpenAPI spec, via openapi-typescript.

A thin wrapper, not a reimplementation of openapi-typescript's CLI — its only
job is accepting the spec the same way the other two generators in this
directory do (positional argument first, `ADH_OPENAPI_SPEC` as fallback, a
leading `--` stripped), so all three `gen*` package.json scripts share one
calling convention.

Before this existed, `gen` was
`openapi-typescript "${ADH_OPENAPI_SPEC:?…}" -o src/schema.ts` — env-var
only, so `pnpm --filter @agentic-toolkit/adh-api-types gen -- <spec>` (the
form `gen:crud-metadata` and `gen:api-endpoints` already accept) expanded to
`openapi-typescript "" -o src/schema.ts -- <spec>` and died on the `:?`
guard.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from _spec_input import resolve_spec

PACKAGE_DIR = Path(__file__).resolve().parents[1]
OUT_PATH = PACKAGE_DIR / "src" / "schema.ts"
# pnpm scripts run with node_modules/.bin on PATH, but this file may also be
# invoked directly (`python3 tools/gen_schema.py`) outside that context —
# resolve the binary explicitly so both work the same way.
OPENAPI_TYPESCRIPT = PACKAGE_DIR / "node_modules" / ".bin" / "openapi-typescript"


def main() -> None:
    spec = resolve_spec()
    binary = str(OPENAPI_TYPESCRIPT) if OPENAPI_TYPESCRIPT.is_file() else "openapi-typescript"
    result = subprocess.run(
        [binary, str(spec), "-o", str(OUT_PATH)],
        cwd=PACKAGE_DIR,
    )
    sys.exit(result.returncode)


if __name__ == "__main__":
    main()
