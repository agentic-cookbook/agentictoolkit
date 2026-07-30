import type { ContentCatalog, Locale } from '../types'
import { en } from './en'

/** Every locale's content catalog, keyed by locale. Add a language by dropping a
 *  `content/<locale>.json`, importing its wrapper, and adding it here. Assembly
 *  falls back to the default locale for any node a non-default locale omits. */
export const catalogs: Partial<Record<Locale, ContentCatalog>> = { en }
