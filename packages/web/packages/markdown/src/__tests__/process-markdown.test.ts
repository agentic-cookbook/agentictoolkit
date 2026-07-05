import { describe, it, expect } from 'vitest'
import { processMarkdown } from '../lib/process-markdown'

// The shiki highlighter + processor are module-level singletons — they init on
// the first processMarkdown call and are reused across all tests in this file.
// testTimeout in vitest.config.ts is 30 s to cover the first-call init cost.

describe('processMarkdown', () => {
  // c5: frontmatter must be stripped from the rendered HTML body
  it('strips YAML frontmatter and exposes it as metadata', async () => {
    const raw = '---\ntitle: Hello\n---\n\n# Heading\n\nbody'
    const result = await processMarkdown(raw)

    expect(result.title).toBe('Hello')
    expect(result.frontmatter['title']).toBe('Hello')
    // Heading text must appear in the rendered HTML
    expect(result.html).toContain('Heading')
    // The raw frontmatter block must NOT leak into the body
    expect(result.html).not.toContain('title: Hello')
    // The --- delimiters must NOT appear either
    expect(result.html).not.toContain('---')
  })

  // c4: GFM table extension (remark-gfm)
  it('renders GFM tables', async () => {
    const raw = '| Col A | Col B |\n|-------|-------|\n| Foo   | Bar   |'
    const result = await processMarkdown(raw)

    expect(result.html).toContain('<table')
    expect(result.html).toContain('Foo')
  })

  // c4: GFM task-list extension (remark-gfm)
  it('renders GFM task lists with checkboxes', async () => {
    const raw = '- [x] done\n- [ ] todo'
    const result = await processMarkdown(raw)

    expect(result.html).toContain('type="checkbox"')
  })

  // c4: shiki syntax highlighting on fenced code blocks
  it('highlights fenced code blocks with shiki', async () => {
    const raw = '```ts\nconst x = 1\n```'
    const result = await processMarkdown(raw)

    // shiki wraps output in <pre class="shiki ...">
    expect(result.html).toContain('shiki')
    expect(result.html).toContain('x')
  })

  // c6: XSS inert — raw HTML in markdown is dropped by remark-rehype
  // (allowDangerousHtml defaults to false) and any survivor would be stripped
  // by rehype-sanitize's allowlist.
  it('is inert to XSS payloads', async () => {
    const raw = [
      '<script>alert(1)</script>',
      '<img src=x onerror="alert(1)">',
      '<div style="position:fixed">x</div>',
    ].join('\n')
    const result = await processMarkdown(raw)

    expect(result.html).not.toContain('<script')
    expect(result.html).not.toContain('onerror')
    // style on a div is not in the sanitize allowlist (style is only permitted
    // on pre/code/span for the shiki dual-theme CSS variables)
    expect(result.html).not.toContain('style="position:fixed"')
  })
})
