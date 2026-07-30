import type { ConceptTree, ContentCatalog, Locale, StructureNode } from './types';
export declare const DEFAULT_LOCALE: Locale;
/** The active content locale. A one-line seam: returns the default today; wire it
 *  to the request/render locale when runtime i18n lands. */
export declare function getLocale(): Locale;
/** The HTML `lang` attribute for a locale — the locale tag as-is. The seam every
 *  site's `<html lang>` reads, so flipping `getLocale()` flips the document lang. */
export declare function htmlLang(locale?: Locale): string;
/** The HTML `dir` for a locale: 'rtl' for right-to-left languages, else 'ltr'.
 *  Drives `<html dir>` so the whole document mirrors when an RTL locale is active. */
export declare function localeDir(locale?: Locale): 'ltr' | 'rtl';
/** Reconstruct the full ConceptTree from its structure + locale-keyed content. */
export declare function assembleTree(structure: StructureNode, catalogs: Partial<Record<Locale, ContentCatalog>>, locale?: Locale): ConceptTree;
/** Split a ConceptTree into its locale-agnostic structure + a default-locale
 *  content catalog. Inverse of {@link assembleTree}. */
export declare function decompose(tree: ConceptTree): {
    structure: StructureNode;
    content: ContentCatalog;
};
/** Assert `raw` is a well-formed structure tree and return it typed. */
export declare function parseStructure(raw: unknown): StructureNode;
/** Assert `raw` is a well-formed content catalog and return it typed. */
export declare function parseCatalog(raw: unknown, locale: string): ContentCatalog;
//# sourceMappingURL=assemble.d.ts.map