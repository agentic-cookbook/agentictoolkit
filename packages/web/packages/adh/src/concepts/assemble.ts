import type {
  ConceptNode,
  ConceptTree,
  ContentCatalog,
  Locale,
  NodeContent,
  StructureNode,
} from './types'

// The seam between the two authored layers and the assembled tree every consumer
// reads. `decompose` splits a ConceptTree into { structure, content }; `assembleTree`
// is its inverse, merging structure + the active locale's content back together.
// Keeping these mutual inverses is what lets the data source move (literal → JSON)
// with zero change to the graph, details pages, routes, or the index queries.

export const DEFAULT_LOCALE: Locale = 'en'

/** The active content locale. A one-line seam: returns the default today; wire it
 *  to the request/render locale when runtime i18n lands. */
export function getLocale(): Locale {
  return DEFAULT_LOCALE
}

/** Primary language subtags that render right-to-left. Keyed off a locale's
 *  primary subtag so a regioned RTL locale (e.g. 'ar-EG') still resolves. Ready
 *  for the day an RTL locale joins {@link Locale}; today the only locale is 'en',
 *  so this is dormant-but-correct. */
const RTL_LANGUAGES: ReadonlySet<string> = new Set([
  'ar', 'he', 'fa', 'ur', 'ps', 'sd', 'ug', 'yi', 'dv',
])

/** The HTML `lang` attribute for a locale — the locale tag as-is. The seam every
 *  site's `<html lang>` reads, so flipping `getLocale()` flips the document lang. */
export function htmlLang(locale: Locale = getLocale()): string {
  return locale
}

/** The HTML `dir` for a locale: 'rtl' for right-to-left languages, else 'ltr'.
 *  Drives `<html dir>` so the whole document mirrors when an RTL locale is active. */
export function localeDir(locale: Locale = getLocale()): 'ltr' | 'rtl' {
  const primary = locale.toLowerCase().split('-')[0] || locale
  return RTL_LANGUAGES.has(primary) ? 'rtl' : 'ltr'
}

/** Resolve a node's copy for `locale`, falling back to the default locale, then to
 *  a minimal stub keyed on the id — so a missing translation degrades gracefully
 *  instead of throwing. (The build-time validator is what hard-fails on a missing
 *  DEFAULT_LOCALE entry; runtime stays resilient.) */
function resolveContent(
  id: string,
  catalogs: Partial<Record<Locale, ContentCatalog>>,
  locale: Locale,
): NodeContent {
  return (
    catalogs[locale]?.[id] ?? catalogs[DEFAULT_LOCALE]?.[id] ?? { label: id, blurb: '' }
  )
}

function assembleNode(
  node: StructureNode,
  catalogs: Partial<Record<Locale, ContentCatalog>>,
  locale: Locale,
): ConceptNode {
  const copy = resolveContent(node.id, catalogs, locale)
  return {
    id: node.id,
    label: copy.label,
    kicker: copy.kicker,
    blurb: copy.blurb,
    detail: copy.detail,
    keyPoints: copy.keyPoints,
    ctas: copy.ctas,
    related: node.related,
    siteId: node.siteId,
    accent: node.accent,
    kind: node.kind,
    docs: node.docs,
    children: node.children?.map((child) => assembleNode(child, catalogs, locale)),
  }
}

/** Reconstruct the full ConceptTree from its structure + locale-keyed content. */
export function assembleTree(
  structure: StructureNode,
  catalogs: Partial<Record<Locale, ContentCatalog>>,
  locale: Locale = getLocale(),
): ConceptTree {
  return assembleNode(structure, catalogs, locale)
}

/** Split a ConceptTree into its locale-agnostic structure + a default-locale
 *  content catalog. Inverse of {@link assembleTree}. */
export function decompose(tree: ConceptTree): {
  structure: StructureNode
  content: ContentCatalog
} {
  const content: ContentCatalog = {}
  function walk(node: ConceptNode): StructureNode {
    content[node.id] = {
      label: node.label,
      kicker: node.kicker,
      blurb: node.blurb,
      detail: node.detail,
      keyPoints: node.keyPoints,
      ctas: node.ctas,
    }
    return {
      id: node.id,
      siteId: node.siteId,
      accent: node.accent,
      kind: node.kind,
      related: node.related,
      docs: node.docs,
      children: node.children?.map(walk),
    }
  }
  return { structure: walk(tree), content }
}

// ── Load-time fail-fast for the JSON sources ────────────────────────────────
// The typed wrappers import raw JSON; without a check the `as` cast would defer
// every shape error to test time. These run at module load to fail fast with a
// clear path on malformed data. They're a cheap STRUCTURAL gate only — the deep
// semantic checks (unique ids, resolvable `related`, real registry siteIds) stay
// in validate-content.py + the vitest suite.

/** Assert `raw` is a well-formed structure tree and return it typed. */
export function parseStructure(raw: unknown): StructureNode {
  const assertNode = (n: unknown, path: string): void => {
    if (!n || typeof n !== 'object') throw new Error(`structure: ${path} is not an object`)
    const o = n as Record<string, unknown>
    if (typeof o.id !== 'string' || !o.id) throw new Error(`structure: ${path} is missing a string id`)
    if (o.children !== undefined) {
      if (!Array.isArray(o.children)) throw new Error(`structure: ${o.id}.children must be an array`)
      o.children.forEach((c, i) => assertNode(c, `${o.id}.children[${i}]`))
    }
  }
  assertNode(raw, 'root')
  return raw as StructureNode
}

/** Assert `raw` is a well-formed content catalog and return it typed. */
export function parseCatalog(raw: unknown, locale: string): ContentCatalog {
  if (!raw || typeof raw !== 'object') throw new Error(`content[${locale}] is not an object`)
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') throw new Error(`content[${locale}].${id} is not an object`)
    const c = v as Record<string, unknown>
    if (typeof c.label !== 'string') throw new Error(`content[${locale}].${id}.label must be a string`)
    if (typeof c.blurb !== 'string') throw new Error(`content[${locale}].${id}.blurb must be a string`)
  }
  return raw as ContentCatalog
}
