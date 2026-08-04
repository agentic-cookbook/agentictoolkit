import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// Where the two drift gates get adh's OpenAPI spec — the one input neither of
// them can derive.
//
// The spec belongs to adh (`frontend/src/sites/api/openapi.json`) and this
// package now lives inside agentictoolkit, which is consumed standalone by
// repos that have no openapi.json at all. Both gates used to read
// `resolve(process.cwd(), '../../main/api/openapi.json')`, a path that was only
// ever correct while the package sat at `frontend/src/app/api-types`; after the
// move it points at a directory that does not exist. So the spec is an explicit
// INPUT — `ADH_OPENAPI_SPEC` — never a walk up the tree.
//
// Unset means "no adh checkout here", which is a legitimate state for this repo,
// so the gates skip rather than fail. A silent skip is how a guard goes blind,
// so `skipNotice()` is the single place that says so out loud, and the gate that
// matters — adh's — is expected to set the variable. Set-but-wrong is never
// tolerated: it throws, because a typo'd path must not read as "no adh here".

const raw = process.env.ADH_OPENAPI_SPEC?.trim()

export const ADH_SPEC_PATH: string | null = raw ? resolve(raw) : null

export function skipNotice(gate: string): void {
  console.warn(
    `SKIPPED ${gate}: ADH_OPENAPI_SPEC is unset, so the committed generated ` +
      `module was cross-checked against nothing. Set it to an adh checkout's ` +
      `frontend/src/sites/api/openapi.json to run this gate.`,
  )
}

export function loadAdhSpec<T>(): T {
  if (!ADH_SPEC_PATH) {
    throw new Error('loadAdhSpec() called with ADH_OPENAPI_SPEC unset')
  }
  try {
    return JSON.parse(readFileSync(ADH_SPEC_PATH, 'utf8')) as T
  } catch (cause) {
    throw new Error(
      `ADH_OPENAPI_SPEC points at ${ADH_SPEC_PATH}, which could not be read as ` +
        `JSON. A wrong path must fail loudly — it must not read as "no adh checkout".`,
      { cause },
    )
  }
}
