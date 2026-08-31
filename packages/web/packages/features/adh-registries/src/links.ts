import type { EntryLink } from '@agentic-toolkit/registry/client';

/**
 * Everything the two sides of a registry link agree on: what a registrant may type, what goes on
 * the wire, and what may become an `href`.
 *
 * These lived in `EntryEditor` while the editor was the only place links existed, and the
 * docblock on `linkProblem` said so out loud — "nothing renders `links` yet, which is the only
 * reason this is a guard and not an incident." The roster's details pane renders them now, so
 * the write-side guard and the read-side one have to be the same rule, in one place, or the pair
 * silently drifts apart. `safeHref` is the read-side half.
 */

/** The only two schemes this app will send. */
export const HTTP_SCHEME = /^https?:\/\//i;

/** Scheme-SHAPED: a run of scheme characters followed by a colon. Necessary, not sufficient. */
const SCHEME_SHAPED = /^[a-z][a-z0-9+.-]*:/i;

/**
 * A host with a port — `example.com:8080`, `localhost:3000/x`.
 *
 * R4-I10: this is what `SCHEME_SHAPED` alone gets wrong. A port satisfies "word, colon" as
 * neatly as a scheme does, so the prefixer read `example.com:8080` as already-schemed, left it
 * alone, and `linkProblem` then refused the save on a link the registrant had typed perfectly
 * correctly. The discriminator is what follows the colon: a port is digits and then either a
 * delimiter or the end of the string, and no scheme name can begin with a digit (RFC 3986 §3.1).
 */
const HOST_PORT = /^[^\s:/?#]+:\d{1,5}(?:[/?#]|$)/;

/** True when `url` already carries a scheme, as opposed to a `host:port` shaped like one. */
export function hasScheme(url: string): boolean {
  return SCHEME_SHAPED.test(url) && !HOST_PORT.test(url);
}

/**
 * What actually goes on the wire for `links`.
 *
 * Two things the raw draft cannot send. A row added but never filled in has `url: ''`, and
 * the server's `entryWrite` types that column as `z.string().url()` — so one empty row 400s
 * the whole save, including every other section's answers. And a registrant types
 * `fishlamp.com`, which is not a URL to `zod` either; rejecting that with
 * "links.0.url: Invalid url" is a message nobody can act on, so add the scheme they meant.
 */
export function normalizeLinks(links: readonly EntryLink[]): EntryLink[] {
  return links
    .map((link) => ({ label: link.label.trim(), url: link.url.trim() }))
    .filter((link) => link.url !== '')
    .map((link) => ({
      ...link,
      url: hasScheme(link.url) ? link.url : `https://${link.url}`,
    }));
}

/**
 * Why this link cannot be saved, or `null`.
 *
 * Two cases `normalizeLinks` must not decide on its own. A row with a label and no URL is a
 * row being filled in, not an empty one — dropping it destroys what the registrant typed, so
 * it blocks the save instead. And a scheme that is not http(s) survives both the prefixer and
 * the server's `z.string().url()`: `javascript:alert(1)` is a valid URL to zod.
 *
 * `HTTP_SCHEME` requires the slashes, so `https:example.com` is refused rather than sent. It
 * would survive zod, but a scheme-relative-looking address nobody typed on purpose is worth one
 * message that says exactly what to type instead.
 */
export function linkProblem(link: EntryLink): string | null {
  const label = link.label.trim();
  const url = link.url.trim();
  if (url === '') return label === '' ? null : 'A link needs an address, not just a name.';
  return hasScheme(url) && !HTTP_SCHEME.test(url)
    ? 'A link starts with http:// or https://.'
    : null;
}

/**
 * The stored URL as an `href`, or `null` when it must not become one.
 *
 * `linkProblem` runs in the registrant's browser, so it guards what THIS app sends and nothing
 * else. The rows a roster renders were not necessarily written by this app: `entryWrite` accepts
 * `z.string().url()`, which is happy with `javascript:alert(document.cookie)`, so a direct POST
 * to `/registries/:id/entries/mine` could store a link this pane would hand straight to the
 * browser as the registry owner clicks it. The server refuses that shape now too — but a
 * renderer that is only safe because of what some writer promised is one schema change away from
 * being unsafe, and this is the half that is cheap to keep honest.
 *
 * `null` rather than a scrubbed href: a link that cannot be trusted is not a link. The caller
 * still shows the text, so the reader sees what was stored and can judge it themselves.
 */
export function safeHref(url: string): string | null {
  const trimmed = url.trim();
  return HTTP_SCHEME.test(trimmed) ? trimmed : null;
}
