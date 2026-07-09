import { featureTsup } from '../tsup.preset'

// knowledgebases also exposes ./tables (directive-free CRUD table metadata) as its
// own server-safe chunk — see the preset comment on why parse/tables are split out.
export default featureTsup(['src/index.ts', 'src/parse-path.ts', 'src/tables.ts'])
