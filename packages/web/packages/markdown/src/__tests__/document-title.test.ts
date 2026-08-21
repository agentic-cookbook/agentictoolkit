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
// setting a title must touch one line and leave everything else — key order, comments,
// spacing — alone. A gray-matter stringify round-trip would pass a "title is set" assertion
// and silently rewrite the author's document.
//
// The `title:`/`name:` cases below pin a specific backend rule:
// `firstNonEmpty(frontmatter?.title, frontmatter?.name)` (backend/src/adh/src/lib/markdown.ts:90)
// — `title` always wins over `name`, regardless of which key comes first in the file. And the
// writer must never repurpose a `name:` line when inserting/rewriting `title:`.
import { describe, it, expect } from 'vitest'
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
