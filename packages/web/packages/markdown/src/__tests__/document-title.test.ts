// The client mirror of the backend's title derivation, plus the one-key frontmatter write
// that a title field needs.
//
// The derivation cases below are lifted from backend/src/adh/test's expectations for
// `deriveTitle` ON PURPOSE: this file is a MIRROR of backend/src/adh/src/lib/markdown.ts, and
// the pair has no shared package to live in (separate deployables). Keeping the cases
// identical is what makes a drift visible here instead of as a title that changes when you
// save.
//
// The WRITE cases matter more than they look: the store keeps `content` byte-exact, so
// setting a title must touch one key and leave everything else — key order, comments,
// spacing, quoting style — alone. A gray-matter stringify round-trip (parse to a plain
// object, re-emit) would pass a "title is set" assertion and silently rewrite the author's
// document, which is why several cases below assert the WHOLE string rather than the title.
//
// The multi-line-scalar cases are the ones a line regex got wrong, and they are the reason
// this module now parses with the same `yaml` package the backend uses: a `title: >-` block
// read as the literal ">-", and rewriting only the matched line orphaned the continuation
// lines into invalid YAML — at which point the backend fail-softs the ENTIRE `frontmatter`
// jsonb to null and `adh_source`, `summary` and `evaluation` go with it.
//
// The `title:`/`name:` cases below pin a specific backend rule:
// `firstNonEmpty(frontmatter?.title, frontmatter?.name)` (backend/src/adh/src/lib/markdown.ts:90)
// — `title` always wins over `name`, regardless of which key comes first in the file. And the
// writer must never repurpose a `name:` line when inserting/rewriting `title:`.
import { describe, it, expect } from 'vitest'
import { parse as parseYaml } from 'yaml'
import {
  deriveDocumentTitle,
  frontmatterTitle,
  setFrontmatterTitle,
} from '../lib/document-title'

describe('deriveDocumentTitle', () => {
  it('prefers frontmatter title', () => {
    expect(deriveDocumentTitle('---\ntitle: From Matter\n---\n\n# From Body\n')).toBe('From Matter')
  })

  it('falls back to frontmatter name', () => {
    expect(deriveDocumentTitle('---\nname: Named\n---\n\nbody\n')).toBe('Named')
  })

  it('falls back to the first non-empty body line, stripped of its syntax', () => {
    expect(deriveDocumentTitle('\n\n## Hello there\n\nmore\n')).toBe('Hello there')
    expect(deriveDocumentTitle('- Hello there\n')).toBe('Hello there')
    expect(deriveDocumentTitle('> Hello there\n')).toBe('Hello there')
  })

  it('never titles a document after a line inside a code fence', () => {
    expect(deriveDocumentTitle('```\n# Not the title\n```\n\nReal title\n')).toBe('Real title')
  })

  it('treats an unterminated fence as running to the end of the file', () => {
    expect(deriveDocumentTitle('```\n# Not the title\n')).toBe('Untitled')
  })

  it('is Untitled when there is nothing to go on', () => {
    expect(deriveDocumentTitle('')).toBe('Untitled')
    expect(deriveDocumentTitle('---\ntitle: "   "\n---\n')).toBe('Untitled')
  })

  it('prefers title over name regardless of which line comes first', () => {
    expect(deriveDocumentTitle('---\nname: Alpha\ntitle: Beta\n---\n\nbody\n')).toBe('Beta')
  })

  it('caps a derived title at 500 characters — the write-side cap has a mirror on read', () => {
    // The write side (`setFrontmatterTitle`) has its own cap, already covered elsewhere. This
    // pins the DERIVE side: a document whose frontmatter (or first body line) already exceeds
    // the cap — written some other way, or by an older/looser client — must not hand back an
    // unbounded string for a title field to display.
    const longTitle = 'x'.repeat(600)
    expect(deriveDocumentTitle(`---\ntitle: ${longTitle}\n---\n\nbody\n`)).toHaveLength(500)
    expect(deriveDocumentTitle(`${longTitle}\n`)).toHaveLength(500)
  })
})

describe('frontmatterTitle', () => {
  it('reads an explicit title', () => {
    expect(frontmatterTitle('---\ntitle: Explicit\n---\n\nbody')).toBe('Explicit')
  })

  it('reads a quoted title, unquoted', () => {
    expect(frontmatterTitle('---\ntitle: "Quoted: with a colon"\n---\n')).toBe('Quoted: with a colon')
  })

  it('is null when the document only has a body', () => {
    expect(frontmatterTitle('# Just a heading\n')).toBeNull()
  })

  it('is null when the block exists but names no title', () => {
    expect(frontmatterTitle('---\ncategory: Notes\n---\n\nbody')).toBeNull()
  })

  it('prefers title over name regardless of which line comes first', () => {
    expect(frontmatterTitle('---\nname: Alpha\ntitle: Beta\n---\n\nbody\n')).toBe('Beta')
  })
})

describe('setFrontmatterTitle', () => {
  it('replaces the title line and leaves every other line byte-identical', () => {
    const before = '---\n# a comment\ncategory: Notes\ntitle: Old\ntags: [a, b]\n---\n\n# Body\n'
    const after = setFrontmatterTitle(before, 'New')
    expect(after).toBe('---\n# a comment\ncategory: Notes\ntitle: "New"\ntags: [a, b]\n---\n\n# Body\n')
  })

  it('inserts a title as the first key of an existing block', () => {
    expect(setFrontmatterTitle('---\ncategory: Notes\n---\n\nbody', 'New')).toBe(
      '---\ntitle: "New"\ncategory: Notes\n---\n\nbody',
    )
  })

  it('adds a block to a document that has none, keeping the body intact', () => {
    expect(setFrontmatterTitle('# Body\n', 'New')).toBe('---\ntitle: "New"\n---\n\n# Body\n')
  })

  it('escapes quotes and backslashes so any title round-trips', () => {
    const out = setFrontmatterTitle('body', 'He said "hi" \\ bye')
    expect(out).toContain('title: "He said \\"hi\\" \\\\ bye"')
    expect(frontmatterTitle(out)).toBe('He said "hi" \\ bye')
  })

  it('removes the title line when the title is cleared, and the block with it if empty', () => {
    expect(setFrontmatterTitle('---\ntitle: Old\ncategory: Notes\n---\n\nbody', '')).toBe(
      '---\ncategory: Notes\n---\n\nbody',
    )
    expect(setFrontmatterTitle('---\ntitle: Old\n---\n\nbody', '')).toBe('body')
  })

  it('is a no-op when the title already reads that way', () => {
    const doc = '---\ntitle: "Same"\n---\n\nbody'
    expect(setFrontmatterTitle(doc, 'Same')).toBe(doc)
  })

  it('rewrites only the title line and leaves an earlier name line byte-identical', () => {
    const before = '---\nname: Alpha\ntitle: Beta\n---\n\nbody\n'
    const after = setFrontmatterTitle(before, 'Gamma')
    expect(after).toBe('---\nname: Alpha\ntitle: "Gamma"\n---\n\nbody\n')
  })

  it('inserts a title line rather than repurposing a name line, which still stands', () => {
    const before = '---\nname: Alpha\n---\n\nbody\n'
    const after = setFrontmatterTitle(before, 'Gamma')
    expect(after).toBe('---\ntitle: "Gamma"\nname: Alpha\n---\n\nbody\n')
  })

  it('does not inject frontmatter when the document already derives the requested title', () => {
    // No `title:` line, and the derived title (from `name:`) already matches — writing would
    // just be adding a key the author never asked for.
    const before = '---\nname: Same\n---\n\nbody\n'
    expect(setFrontmatterTitle(before, 'Same')).toBe(before)

    // Same for a title derived from the first body line.
    const bodyOnly = '# Same\n\nmore\n'
    expect(setFrontmatterTitle(bodyOnly, 'Same')).toBe(bodyOnly)
  })

  it('does write when the derived title differs, even with no explicit title line', () => {
    const before = '---\nname: Alpha\n---\n\nbody\n'
    expect(setFrontmatterTitle(before, 'Beta')).toBe('---\ntitle: "Beta"\nname: Alpha\n---\n\nbody\n')
  })
})

// The frontmatter shapes a LINE REGEX cannot read. Each of these passes trivially with the
// real parser and fails loudly with a `/^(title|name):[ \t]*(.*)$/` scan — that is the point:
// they are the shapes that shipped broken, not hypotheticals.
describe('multi-line and quoted YAML scalars', () => {
  // The exact document from the defect report: a folded scalar, followed by the two keys a
  // broken rewrite destroys.
  const FOLDED = [
    '---',
    'title: >-',
    '  A long research title',
    '  continued here',
    'adh_source: import-42',
    'summary: what the paper says',
    '---',
    '',
    'body\n',
  ].join('\n')

  it('reads a folded (>-) title as its folded VALUE, not as the ">-" marker', () => {
    expect(frontmatterTitle(FOLDED)).toBe('A long research title continued here')
    expect(deriveDocumentTitle(FOLDED)).toBe('A long research title continued here')
  })

  it('replaces a folded title whole, leaving valid YAML and every other key intact', () => {
    const after = setFrontmatterTitle(FOLDED, 'Short')
    expect(after).toBe(
      '---\ntitle: "Short"\nadh_source: import-42\nsummary: what the paper says\n---\n\nbody\n',
    )
    // The real assertion: what the BACKEND will now store. A stranded continuation line makes
    // the whole block unparseable, and the backend nulls all of it — `adh_source` (import
    // dedupe) and the public page's `summary` included.
    const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(after)?.[1] ?? ''
    expect(parseYaml(block)).toEqual({
      title: 'Short',
      adh_source: 'import-42',
      summary: 'what the paper says',
    })
  })

  it('reads a literal (|) block scalar without swallowing the keys under it', () => {
    const doc = '---\nname: |\n  Line one\n  Line two\nadh_source: keep-me\n---\n\nbody\n'
    expect(frontmatterTitle(doc)).toBe('Line one\nLine two')
    const after = setFrontmatterTitle(doc, 'Titled')
    const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(after)?.[1] ?? ''
    expect(parseYaml(block)).toEqual({
      title: 'Titled',
      // \`|\` is clip mode: the block keeps its trailing newline, which the reader trims.
      name: 'Line one\nLine two\n',
      adh_source: 'keep-me',
    })
  })

  it('reads a quoted scalar containing a colon as one value', () => {
    const doc = '---\ntitle: "Retrieval: a survey"\nadh_source: import-9\n---\n\nbody\n'
    expect(frontmatterTitle(doc)).toBe('Retrieval: a survey')
    expect(setFrontmatterTitle(doc, 'Renamed')).toBe(
      '---\ntitle: "Renamed"\nadh_source: import-9\n---\n\nbody\n',
    )
    // The same value wearing a trailing YAML comment. A line scan cannot see where the scalar
    // ends, so it hands back `"Retrieval: a survey"  # imported 2026-08` — quotes, comment and
    // all — as the document's title.
    const commented =
      '---\ntitle: "Retrieval: a survey"  # imported 2026-08\nadh_source: import-9\n---\n\nbody\n'
    expect(frontmatterTitle(commented)).toBe('Retrieval: a survey')
  })

  it('does not mistake a nested title for the document\'s own', () => {
    const doc = '---\nevaluation:\n  title: inner\n  score: 3\n---\n\n# Real\n'
    expect(frontmatterTitle(doc)).toBeNull()
    expect(deriveDocumentTitle(doc)).toBe('Real')
    expect(setFrontmatterTitle(doc, 'Outer')).toBe(
      '---\ntitle: "Outer"\nevaluation:\n  title: inner\n  score: 3\n---\n\n# Real\n',
    )
  })

  it('writes a title that needs quoting so it reads back as itself', () => {
    for (const title of [
      'Retrieval: a survey',
      '- leading dash',
      '# not a comment',
      '>- not a fold',
      'He said "hi" \\ bye',
      "it's #1: yes",
      'true',
      '2026-08-23',
      // A pasted two-line title. The hand-rolled quoter escaped `"` and `\\` only, so this went
      // into the file as a RAW newline inside the quotes — which YAML folds back to a space.
      'Two lines\nof title',
    ]) {
      const out = setFrontmatterTitle('---\nadh_source: keep\n---\n\nbody\n', title)
      expect(frontmatterTitle(out)).toBe(title)
      const block = /^---\r?\n([\s\S]*?)\r?\n---/.exec(out)?.[1] ?? ''
      expect(parseYaml(block)).toEqual({ title, adh_source: 'keep' })
    }
  })

  it('leaves a document with no frontmatter alone, and gives it a clean block when titled', () => {
    expect(frontmatterTitle('# Heading\n\nbody\n')).toBeNull()
    expect(setFrontmatterTitle('# Heading\n\nbody\n', 'Heading')).toBe('# Heading\n\nbody\n')
    expect(setFrontmatterTitle('# Heading\n\nbody\n', 'Other')).toBe(
      '---\ntitle: "Other"\n---\n\n# Heading\n\nbody\n',
    )
    // The block a bare document gets has to be valid YAML for ANY title, including one the
    // hand-rolled quoter could not escape.
    const created = setFrontmatterTitle('# Heading\n\nbody\n', 'Two lines\nof title')
    expect(frontmatterTitle(created)).toBe('Two lines\nof title')
    const madeBlock = /^---\r?\n([\s\S]*?)\r?\n---/.exec(created)?.[1] ?? ''
    expect(parseYaml(madeBlock)).toEqual({ title: 'Two lines\nof title' })
  })

  it('re-emits an untouched block byte-identically', () => {
    // Setting the title a document ALREADY states must return the same string — not merely an
    // equivalent one. The store hashes `content`, so a re-quoted or re-wrapped bystander line
    // is a phantom edit and a spurious save conflict.
    const doc = [
      '---',
      '# hand-written comment',
      'title: Plain Title',
      'tags: [a, b]',
      "single: 'it''s here'",
      'summary: a single line long enough that a default 80-column fold would break it in two',
      'nested:',
      '  deep: 1',
      '---',
      '',
      'body\n',
    ].join('\n')
    expect(setFrontmatterTitle(doc, 'Plain Title')).toBe(doc)
  })

  it('refuses to rewrite frontmatter it cannot parse', () => {
    // Unparseable YAML is exactly where a line rewrite did its damage. There is nothing safe to
    // write into a block whose shape is unknown, and the author can still edit the frontmatter
    // directly — it is part of `content`.
    const broken = '---\ntitle: [unclosed\nadh_source: keep\n---\n\nbody\n'
    expect(frontmatterTitle(broken)).toBeNull()
    expect(setFrontmatterTitle(broken, 'New')).toBe(broken)
  })
})
