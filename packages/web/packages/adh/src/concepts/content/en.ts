import { parseCatalog } from '../assemble'
import enJson from '@agentic-toolkit/adh-site-config/content/en.json'

// Canonical COPY source for the default locale, from the `@agentic-toolkit/adh-site-config`
// data package (a workspace sibling: `adh-site-config/content/en.json`). `parseCatalog` checks the
// shape at module load (fail-fast) and returns it typed. One catalog per locale — add
// a language by dropping `content/<locale>.json` there and importing it in
// `content/index.ts`.
export const en = parseCatalog(enJson, 'en')
