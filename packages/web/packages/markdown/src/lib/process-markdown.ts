/**
 * Async markdown → HTML pipeline.
 *
 * Stack (matches websites/main/cookbook to avoid duplicate deps):
 *   gray-matter            → strip YAML frontmatter (c5: never leak the --- block)
 *   remark-parse + gfm     → GFM markdown AST (tables, task lists, …)
 *   remark-rehype          → hast (allowDangerousHtml:false → embedded raw HTML
 *                            is DROPPED, never passed through)
 *   rehype-slug + autolink → anchored headings
 *   @shikijs/rehype (core) → syntax-highlight fenced code into REAL hast element
 *                            nodes BEFORE sanitize (dual-theme CSS variables)
 *   rehype-sanitize        → allowlist sanitize over real element nodes (c6)
 *   rehype-stringify       → HTML string (NO allowDangerousHtml)
 *
 * Security (c6): the shiki highlight produces normal element nodes, so the
 * sanitizer traverses them like any other markup — code blocks are NOT bypassed.
 * Nothing in the pipeline emits or stringifies hast `raw` nodes, so no embedded
 * <script>/<img onerror> can reach the DOM: remark-rehype drops it, and the
 * sanitize allowlist would strip it even if present.
 *
 * The shiki highlighter is created once and cached at module scope.
 */

import matter from 'gray-matter'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import rehypeShikiFromHighlighter from '@shikijs/rehype/core'
import type { Highlighter } from 'shiki'
import { remarkAdhAlerts } from './remark-adh-alerts'

// ── Shiki singleton ────────────────────────────────────────────────────────────

let _highlighterPromise: Promise<Highlighter> | null = null

/** Returns the shared highlighter, initialising it on first call. */
function getHighlighter(): Promise<Highlighter> {
  if (!_highlighterPromise) {
    // Dynamic import keeps the heavy shiki engine out of the initial chunk
    // when the host app's bundler tree-shakes properly.
    _highlighterPromise = import('shiki').then(({ createHighlighter }) =>
      createHighlighter({
        // Dual themes — emitted as CSS variables so the viewer can switch
        // light/dark instantly via `data-mdv-theme` without re-highlighting.
        themes: ['github-light', 'github-dark'],
        langs: [
          'typescript',
          'javascript',
          'tsx',
          'jsx',
          'python',
          'bash',
          'shell',
          'json',
          'html',
          'css',
          'markdown',
          'rust',
          'go',
          'yaml',
          'sql',
          'diff',
        ],
      }),
    )
  }
  return _highlighterPromise
}

// ── Sanitization schema ────────────────────────────────────────────────────────

/**
 * Allowlist sanitize schema. Attribute keys use hast property names (camelCase:
 * `className`, `tabIndex`, `style`). Allows a safe prose subset plus the
 * `className`/`style` shiki emits on `pre`/`code`/`span` (the dual-theme CSS
 * variables that drive code-block colors).
 *
 * Event handlers (on*), `javascript:` URLs, and <script>/<style>/<iframe> are
 * intentionally absent — this is an allowlist, not a denylist.
 */
const sanitizeSchema = {
  allowComments: false,
  allowDoctypes: false,
  strip: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
  // No id/name clobber-prefixing: it would rewrite heading ids (rehype-slug) but
  // not the matching autolink hrefs, breaking in-page anchors. The XSS surface
  // (script execution, event handlers, javascript: URLs) is closed by the tag +
  // attribute allowlist below regardless.
  clobberPrefix: '',
  clobber: [],
  attributes: {
    // NOTE: `style` is deliberately NOT allowed globally. It is scoped to the
    // shiki nodes (pre/code/span) below, where it only carries the dual-theme
    // CSS variables. Allowing it on `*` would let an inline style (CSS overlay /
    // background-url exfil) survive sanitize if anything ever injected one —
    // an unnecessary widening of the c6 attack surface for a read-only viewer.
    '*': ['id', 'className', 'tabIndex', 'title', 'dir', 'lang'],
    a: ['href', 'hrefLang', 'rel', 'target'],
    blockquote: ['cite'],
    code: ['className', 'style'],
    del: ['dateTime'],
    img: ['src', 'srcSet', 'alt', 'width', 'height', 'loading', 'decoding'],
    input: ['type', 'checked', 'disabled'],
    ins: ['dateTime', 'cite'],
    li: ['className'],
    ol: ['reversed', 'start', 'type'],
    pre: ['className', 'style', 'tabIndex'],
    q: ['cite'],
    span: ['className', 'style'],
    table: ['align', 'cellPadding', 'cellSpacing'],
    td: ['align', 'colSpan', 'rowSpan', 'valign'],
    th: ['align', 'colSpan', 'rowSpan', 'scope', 'valign'],
  },
  tagNames: [
    // Structure
    'div', 'span', 'p', 'br', 'hr',
    // Headings
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    // Inline
    'a', 'em', 'strong', 's', 'del', 'ins', 'sup', 'sub', 'abbr', 'q', 'cite',
    'mark', 'kbd', 'samp', 'var', 'small',
    // Lists
    'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    // Blocks
    'blockquote', 'pre', 'code',
    // Tables
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'col', 'colgroup',
    // Media
    'img', 'figure', 'figcaption',
    // Task lists
    'input',
    // Misc
    'details', 'summary', 'section', 'article',
  ],
  protocols: {
    href: ['http', 'https', 'mailto', 'tel'],
    src: ['http', 'https'],
    cite: ['http', 'https'],
  },
}

// ── Public API ─────────────────────────────────────────────────────────────────

export interface ProcessedMarkdown {
  /** Sanitised HTML string ready for dangerouslySetInnerHTML. */
  html: string
  /** Parsed frontmatter key-value pairs (stripped from the rendered body). */
  frontmatter: Record<string, unknown>
  /** Document title from frontmatter, if present. */
  title?: string
}

/**
 * Build the unified pipeline. The pipeline is stateless and identical across
 * calls, so a single frozen processor is built once (after the highlighter is
 * ready) and reused — `.freeze()` makes it safe to run repeatedly/concurrently.
 */
function buildProcessor(highlighter: Highlighter) {
  return unified()
    .use(remarkParse)
    .use(remarkGfm)
    // GitHub alert blockquotes (> [!WARNING] …) → ADH callout divs (ours, styled like the
    // rest of ADH). Runs on mdast before remark-rehype reads its data.hName/hProperties.
    .use(remarkAdhAlerts)
    // allowDangerousHtml:false → embedded raw HTML/script is dropped, not passed.
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, { behavior: 'wrap' })
    // Highlight BEFORE sanitize, producing real element nodes (not raw HTML).
    .use(rehypeShikiFromHighlighter, highlighter, {
      themes: { light: 'github-light', dark: 'github-dark' },
      // No default color → tokens carry only --shiki-light/--shiki-dark vars,
      // which the viewer CSS selects between by data-mdv-shiki-variant.
      defaultColor: false,
      fallbackLanguage: 'text',
    })
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeStringify)
    .freeze()
}

let _processorPromise: Promise<ReturnType<typeof buildProcessor>> | null = null

/** Returns the shared frozen processor, building it once on first call. */
function getProcessor(): Promise<ReturnType<typeof buildProcessor>> {
  if (!_processorPromise) {
    _processorPromise = getHighlighter().then(buildProcessor)
  }
  return _processorPromise
}

/**
 * Process raw markdown (including optional YAML frontmatter) into safe,
 * syntax-highlighted HTML. Theme-independent: code-block colors are emitted as
 * CSS variables, so the viewer re-themes without re-processing.
 *
 * @param raw - Raw markdown string from the MarkdownDocument.content field.
 */
export async function processMarkdown(raw: string): Promise<ProcessedMarkdown> {
  // c5: strip frontmatter before rendering so the --- block never reaches the body.
  const { content, data: frontmatter } = matter(raw)

  const processor = await getProcessor()
  const result = await processor.process(content)

  return {
    html: String(result),
    frontmatter: frontmatter as Record<string, unknown>,
    title: typeof frontmatter['title'] === 'string' ? frontmatter['title'] : undefined,
  }
}
