/**
 * A document's TITLE, client-side.
 *
 * The API never accepts a title — it DERIVES one (`backend/src/adh/src/lib/markdown.ts`,
 * `deriveTitle`) so that every client shows the same name for the same document. An editor
 * that wants a title field therefore edits the only place an author can state one: the
 * frontmatter `title:` key.
 *
 * `deriveDocumentTitle` below MIRRORS that backend function, rule for rule. The two have no
 * shared package (separate deployables, one Node, one browser), so the mirror is deliberate
 * and the tests carry the backend's own cases; if you change one, change both. What they DO
 * now share is the parser: both call the `yaml` package (`^2.9.0` in both manifests), because
 * a hand-rolled line regex is not a YAML parser and the two only appeared to agree.
 *
 * WHY NOT A LINE REGEX (the bug this file was rewritten to close). This module used to scan
 * raw lines for `/^(title|name):[ \t]*(.*)$/` and rewrite the matched line in place. On any
 * frontmatter YAML that spans more than one line per key that is wrong in BOTH directions:
 *
 *     ---
 *     title: >-
 *       A long research title
 *       continued here
 *     adh_source: import-42
 *     summary: …
 *     ---
 *
 * The reader returned the literal `">-"` as the title. The writer replaced only the `title: >-`
 * line and left the two indented continuation lines behind, orphaned under `title: "New"` —
 * which is not valid YAML. The backend then fail-softs the ENTIRE `frontmatter` jsonb to null,
 * so a single title edit destroyed `adh_source` (import dedupe) and the public page's `summary`
 * and `evaluation`, not just the title. Nothing errored anywhere along that path.
 *
 * WHY NOT gray-matter / js-yaml EITHER. The store keeps `content` byte-exact, and a
 * parse-then-restringify through a plain object loses everything that is not data: comments,
 * key order, quoting style, flow collections. `yaml`'s Document API is the tool that fits — it
 * keeps the parsed CST, so untouched entries re-emit byte-identically and only the `title` pair
 * is rewritten. {@link STRINGIFY} pins the two options that would otherwise reformat a
 * bystander line, and the tests assert whole documents rather than "the title is set".
 */
import { Document, Scalar, isMap, parseDocument, parse as parseYaml } from 'yaml';

/** Leading YAML frontmatter block. Mirrors the backend's FRONTMATTER_RE exactly. */
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/;

/**
 * Stringify options chosen so that re-emitting an UNEDITED block is byte-identical.
 *
 * `flowCollectionPadding` defaults to true and would turn a bystander's `tags: [a, b]` into
 * `tags: [ a, b ]`; `lineWidth` defaults to 80 and would fold a long `summary:` onto a second
 * line. Neither is a data change, which is exactly what makes them dangerous: they show up as
 * a diff on a document the author did not touch, and (for the fold) as a different
 * `contentHash`, i.e. a spurious save conflict. Both off, a no-op edit is a no-op.
 */
const STRINGIFY = { flowCollectionPadding: false, lineWidth: 0 } as const;

/** Shared with the backend's 500-char column cap. */
const MAX_TITLE = 500;

/**
 * Always double-quoted, whatever the title says. A double-quoted scalar is valid YAML for ANY
 * string — a colon, a leading `-`, a `#`, a newline, a lone `>` — so there is no branch here
 * and no title the writer can mangle. `yaml` does the escaping; the hand-rolled version this
 * replaced escaped `"` and `\` only, and would have emitted a raw newline inside the quotes for
 * a pasted two-line title, which YAML folds back to a space.
 */
function quoted(title: string): Scalar {
  const node = new Scalar(title);
  node.type = Scalar.QUOTE_DOUBLE;
  return node;
}

/**
 * Parse the leading frontmatter block into a plain object, or null when there is none, it is
 * not a mapping, or it does not parse. MIRRORS the backend's `parseFrontmatter` — same package,
 * same `logLevel: 'silent'`, same fail-soft — so that the title this module shows and the title
 * the API derives are answers from the same parser rather than two hopeful guesses.
 */
function frontmatterOf(content: string): Record<string, unknown> | null {
  const block = FRONTMATTER_RE.exec(content);
  if (!block) return null;
  try {
    const parsed = parseYaml(block[1] ?? '', { logLevel: 'silent' }) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** First argument that is a non-empty (trimmed) string, else null. The backend's
 *  `firstNonEmpty`, verbatim — note it requires a STRING, so `title: 42` states no title and
 *  the search falls through to `name`. */
function firstNonEmpty(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

/** The author's explicitly stated title, or null when the document states none.
 *
 *  `title` wins over `name` regardless of which key appears first in the file, and a nested
 *  `title:` under some other key is not the document's own — both fall out of parsing the block
 *  as YAML and reading the top-level mapping, where the old line scan had to hand-code the
 *  first rule and approximate the second with a "no leading indent" anchor. */
export function frontmatterTitle(content: string): string | null {
  const fm = frontmatterOf(content);
  if (!fm) return null;
  return firstNonEmpty(fm.title, fm.name);
}

/** Strip frontmatter and fenced code, so a line inside a sample can't become the title. */
function titleSearchBody(content: string): string {
  return content
    .replace(FRONTMATTER_RE, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/~~~[\s\S]*?~~~/g, '')
    .replace(/(?:^|\n)(?:```|~~~)[\s\S]*$/, '');
}

/** Drop the markdown a line OPENS with — quote arrows, heading hashes, list markers. */
function stripLineSyntax(line: string): string {
  return line
    .replace(/^[ \t]*(?:>[ \t]?)+/, '')
    .replace(/^[ \t]*#{1,6}(?=[ \t]|$)[ \t]*/, '')
    .replace(/^[ \t]*(?:[-*+]|\d+[.)])(?=[ \t]|$)[ \t]*/, '')
    .trim();
}

/** The title the API will derive for this content — frontmatter, else the first body line,
 *  else `Untitled`. Use it to FILL a title field, so an untitled document shows the name it
 *  is already known by rather than an empty box. */
export function deriveDocumentTitle(content: string): string {
  const explicit = frontmatterTitle(content);
  if (explicit) return explicit.slice(0, MAX_TITLE);
  for (const raw of titleSearchBody(content).split('\n')) {
    const line = stripLineSyntax(raw);
    if (line) return line.slice(0, MAX_TITLE);
  }
  return 'Untitled';
}

/** Move the key `doc.set` just appended to the FRONT of the mapping.
 *
 *  A newly stated title belongs first, so a reader opening the file sees the document's name
 *  before its bookkeeping — and so the insert position is deterministic rather than "wherever
 *  the map happened to end". Done by moving the pair `set` appended rather than by building one
 *  with `createPair`, which keeps the node types the parser produced. */
function moveLastKeyToFront(doc: Document): void {
  const map = doc.contents;
  if (!isMap(map) || map.items.length < 2) return;
  const added = map.items.pop();
  if (added) map.items.unshift(added);
}

/** A brand-new one-key block, for a document that has no frontmatter yet. */
function freshBlock(title: string): string {
  const doc = new Document({});
  doc.set('title', quoted(title));
  return doc.toString(STRINGIFY);
}

/**
 * Return `content` with its frontmatter `title:` set to `title` — or removed, when `title` is
 * blank. A `name:` line is NEVER touched: `title` and `name` are separate keys and only `title`
 * is addressed here, so the writer cannot repurpose a `name:` line the way the old
 * `(title|name)` regex once did.
 *
 * Everything else in the block is re-emitted from `yaml`'s parsed Document, which preserves key
 * order, comments, quoting style and flow collections — see {@link STRINGIFY} for the two
 * options that make an untouched block come back byte-identical. CRLF line endings INSIDE the
 * block still come back as LF (YAML has no line-ending-sensitive syntax, and the body below the
 * block is sliced off untouched, so its endings are whatever the author left).
 *
 * Clearing the last key removes the now-empty block entirely: a document whose whole
 * frontmatter was its title should not be left wearing an empty `---\n---`.
 *
 * When the block has no `title:` key, a new one is normally inserted FIRST — UNLESS the
 * document already derives to the requested title (via `name:` or its first body line), in
 * which case `content` is returned unchanged. Without that check, merely opening a document and
 * saving it with no real edit would inject a `title:` key the author never wrote. For the same
 * reason, a `title:` already reading exactly `title` is left alone rather than requoted.
 *
 * MALFORMED FRONTMATTER IS LEFT ALONE. If the block does not parse, or is not a mapping, the
 * content comes back unchanged and the title field simply refuses the edit. Rewriting a block
 * we could not read is how the whole `frontmatter` blob got destroyed in the first place, and
 * the author still has the direct escape hatch — the frontmatter is part of `content`, which
 * the markdown editor edits as text.
 */
export function setFrontmatterTitle(content: string, title: string): string {
  const next = title.trim().slice(0, MAX_TITLE);
  const block = FRONTMATTER_RE.exec(content);

  if (!block) {
    if (!next) return content;
    if (deriveDocumentTitle(content) === next) return content;
    return `---\n${freshBlock(next)}---\n\n${content}`;
  }

  const doc = parseDocument(block[1] ?? '', { logLevel: 'silent' });
  if (doc.errors.length > 0) return content;
  // `contents === null` is the legitimately EMPTY block (`---\n\n---`) — `doc.set` below turns
  // it into a one-key mapping. Anything else non-map (a sequence, a bare scalar) is frontmatter
  // this module has no business rewriting.
  if (doc.contents !== null && !isMap(doc.contents)) return content;

  const current = doc.get('title');
  if (current === undefined) {
    if (!next) return content;
    if (deriveDocumentTitle(content) === next) return content;
    doc.set('title', quoted(next));
    moveLastKeyToFront(doc);
  } else if (!next) {
    doc.delete('title');
  } else if (typeof current === 'string' && current === next) {
    // Already says exactly this. Re-emitting would requote a plain scalar for no reason, which
    // is a diff (and a new content hash) on a document nobody edited.
    return content;
  } else {
    doc.set('title', quoted(next));
  }

  // FRONTMATTER_RE consumes the newline that follows the closing `---`, so `rest` already
  // starts at the body — reattaching it after the re-emitted block preserves the blank line
  // (or its absence) exactly as the author left it.
  const rest = content.slice(block[0].length);
  // Nothing left to state: drop the block, and with it the blank line that separated it from
  // the body — an empty `---\n---` (or a document that now opens on whitespace) is worse than
  // no frontmatter at all. (`yaml` would render the empty mapping as a literal `{}`.)
  if (isMap(doc.contents) && doc.contents.items.length === 0) return rest.replace(/^\r?\n/, '');
  return `---\n${doc.toString(STRINGIFY)}---\n${rest}`;
}
