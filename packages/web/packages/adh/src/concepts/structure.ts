import { parseStructure } from './assemble'
import structureJson from '@agentic-toolkit/adh-site-config/structure.json'

// The canonical SHAPE source lives in the `@agentic-toolkit/adh-site-config` data package
// (a workspace sibling: `adh-site-config/structure.json`) — the editable source of truth the content
// studio round-trips. `parseStructure` checks the shape at module load and returns it
// typed (fail-fast instead of a bare `as` cast), while `validate-content.py` (+ the
// vitest content guard) enforce the deep invariants — real siteIds, resolvable ids,
// valid kinds — at build time.
export const conceptStructure = parseStructure(structureJson)
