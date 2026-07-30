import { HELP_CONTENT_HTML } from '../help/content.generated'

/**
 * Doc content lookup by base-relative slug. The content lives once in `help/content/*.md`
 * (PRE-RENDERED to HTML in `content.generated.ts` by `tools/gen-help-content.py`) and is consumed
 * by BOTH the Help modal and the docs sites — one source, one derived HTML representation. The
 * generator keys by file path with `/`→`-`; this maps a nav slug to that key (`''`→`index`,
 * `oauth/overview`→`oauth-overview`).
 */
export function docContentKey(slug: string): string {
  return slug === '' ? 'index' : slug.replaceAll('/', '-')
}

/** The pre-rendered HTML for a doc slug (inject with `MarkdownHtml`), or `undefined` if there's no
 *  content file for it. */
export function getDocHtml(slug: string): string | undefined {
  return HELP_CONTENT_HTML[docContentKey(slug)]
}

/** The pre-rendered HTML for a raw content key (the generator's file-path key, e.g. `oauth-overview`),
 *  or `undefined`. Help topics carry their `contentKey` directly, so — unlike {@link getDocHtml} —
 *  the lookup skips the slug→key projection (a topic's route slug no longer mirrors its content key). */
export function getDocHtmlByKey(key: string): string | undefined {
  return HELP_CONTENT_HTML[key]
}
