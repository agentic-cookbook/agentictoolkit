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
 * and the tests carry the backend's own cases; if you change one, change both.
 *
 * `setFrontmatterTitle` writes ONE LINE. The store keeps `content` byte-exact, so a
 * parse-and-restringify (gray-matter, js-yaml) is the wrong tool: it would reorder keys, drop
 * comments, and requote values in a body the author wrote by hand.
 */

/** Leading YAML frontmatter block. Mirrors the backend's FRONTMATTER_RE exactly. */
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/;

/** A top-level `title:`/`name:` line inside a frontmatter block — no leading indent, so a
 *  nested `title:` under some other key is not mistaken for the document's own.
 *
 *  READER only. The backend derives a title with `firstNonEmpty(frontmatter?.title,
 *  frontmatter?.name)` (`backend/src/adh/src/lib/markdown.ts:90`) — `title` always wins over
 *  `name`, regardless of which line comes first in the file. This regex is used only to
 *  *find* candidate lines while scanning the whole block for both keys; the WRITER below uses
 *  a narrower, `title`-only regex so it can never mistake a `name:` line for the one to
 *  rewrite. Collapsing the two back into one regex is what caused the bug this comment is
 *  guarding against: a document with `name:` before `title:` would get its `name:` line
 *  clobbered by a title edit. */
const TITLE_LINE_RE = /^(title|name):[ \t]*(.*)$/;

/** WRITER-only: matches a `title:` line and nothing else. `setFrontmatterTitle` must never
 *  repurpose a `name:` line — see {@link TITLE_LINE_RE} for why the reader can't be reused
 *  here. */
const TITLE_ONLY_LINE_RE = /^title:[ \t]*(.*)$/;

const MAX_TITLE = 500;

function unquote(raw: string): string {
  const v = raw.trim();
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
    const inner = v.slice(1, -1);
    return v.startsWith('"') ? inner.replace(/\\(["\\])/g, '$1') : inner.replace(/''/g, "'");
  }
  return v;
}

/** Always double-quoted: a quoted scalar is valid YAML for ANY title, so there is no branch
 *  where a colon, a `#`, or a leading `-` needs special handling. */
function quote(title: string): string {
  return `"${title.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** The author's explicitly stated title, or null when the document states none.
 *
 *  Scans every line of the frontmatter block, collecting the first non-empty `title:` value
 *  AND the first non-empty `name:` value (each independently — line order does not matter),
 *  then returns the `title` one if present, else the `name` one, else null. This mirrors the
 *  backend's `firstNonEmpty(frontmatter?.title, frontmatter?.name)` exactly: `title` wins
 *  regardless of which key appears first in the file. */
export function frontmatterTitle(content: string): string | null {
  const block = FRONTMATTER_RE.exec(content);
  if (!block) return null;
  let titleVal: string | null = null;
  let nameVal: string | null = null;
  for (const line of (block[1] ?? '').split(/\r?\n/)) {
    const m = TITLE_LINE_RE.exec(line);
    if (!m) continue;
    // Trimmed, like the backend's firstNonEmpty: a `title: "   "` states no title.
    const value = unquote(m[2] ?? '').trim();
    if (!value) continue;
    if (m[1] === 'title') {
      if (titleVal === null) titleVal = value;
    } else if (nameVal === null) {
      nameVal = value;
    }
  }
  return titleVal ?? nameVal;
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

/**
 * Return `content` with its frontmatter `title:` set to `title` — or removed, when `title` is
 * blank. Everything outside that single line is preserved byte for byte, and a `name:` line is
 * NEVER touched (see {@link TITLE_ONLY_LINE_RE}).
 *
 * Clearing the last key removes the now-empty block entirely: a document whose whole
 * frontmatter was its title should not be left wearing an empty `---\n---`.
 *
 * When the block has no `title:` line, a new one is normally inserted — UNLESS the document
 * already derives to the requested title (via `name:` or its first body line), in which case
 * `content` is returned unchanged. Without that check, merely opening a document and saving it
 * with no real edit would inject a `title:` key the author never wrote.
 */
export function setFrontmatterTitle(content: string, title: string): string {
  const next = title.trim().slice(0, MAX_TITLE);
  const block = FRONTMATTER_RE.exec(content);

  if (!block) {
    if (!next) return content;
    if (deriveDocumentTitle(content) === next) return content;
    return `---\ntitle: ${quote(next)}\n---\n\n${content}`;
  }

  // FRONTMATTER_RE consumes the newline that follows the closing `---`, so `rest` already
  // starts at the body — reattaching it after a freshly built block preserves the blank line
  // (or its absence) exactly as the author left it.
  const rest = content.slice(block[0].length);
  const lines = (block[1] ?? '').split(/\r?\n/);
  const at = lines.findIndex((l) => TITLE_ONLY_LINE_RE.test(l));

  let kept: string[];
  if (at >= 0) {
    kept = next
      ? [...lines.slice(0, at), `title: ${quote(next)}`, ...lines.slice(at + 1)]
      : [...lines.slice(0, at), ...lines.slice(at + 1)];
  } else {
    if (!next) return content;
    if (deriveDocumentTitle(content) === next) return content;
    kept = [`title: ${quote(next)}`, ...lines];
  }

  // Nothing left to state: drop the block, and with it the blank line that separated it from
  // the body — an empty `---\n---` (or a document that now opens on whitespace) is worse than
  // no frontmatter at all.
  if (kept.every((l) => !l.trim())) return rest.replace(/^\r?\n/, '');
  return `---\n${kept.join('\n')}\n---\n${rest}`;
}
