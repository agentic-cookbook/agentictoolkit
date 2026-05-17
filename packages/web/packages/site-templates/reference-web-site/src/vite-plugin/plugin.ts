import { type Plugin } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypeStringify from 'rehype-stringify'
import type { SiteEntry, HeadingEntry } from '../types'
import { rehypeCrossReferences } from './cross-references'
import { transformIndexHtml } from './transform-html'
import type { ReferenceSitePluginOptions } from './types'

const VIRTUAL_MODULE_ID = 'virtual:reference-site-content'
const RESOLVED_VIRTUAL_MODULE_ID = '\0' + VIRTUAL_MODULE_ID

function collectMarkdownFiles(dir: string): string[] {
  const files: string[] = []
  if (!fs.existsSync(dir)) return files
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(fullPath))
    } else if (entry.name.endsWith('.md') && entry.name !== '_template.md') {
      files.push(fullPath)
    }
  }
  return files
}

function filePathToSlug(filePath: string, baseDir: string): string {
  let relative = path.relative(baseDir, filePath).replace(/\.md$/, '')
  relative = relative.replace(/[/\\](INDEX|index)$/, '')
  if (relative === 'index' || relative === '') return '/'
  return '/' + relative.split(path.sep).join('/')
}

function deriveSection(slug: string): { section: string; subsection: string | null } {
  const parts = slug.split('/').filter(Boolean)
  return {
    section: parts[0] ?? '',
    subsection: parts.length > 2 ? (parts[1] ?? null) : null,
  }
}

function extractHeadings(html: string): HeadingEntry[] {
  const headings: HeadingEntry[] = []
  const regex = /<h([23])\s+id="([^"]*)"[^>]*>(.*?)<\/h[23]>/g
  let match
  while ((match = regex.exec(html)) !== null) {
    const depthStr = match[1]
    const id = match[2]
    const raw = match[3]
    if (depthStr == null || id == null || raw == null) continue
    headings.push({
      depth: parseInt(depthStr, 10),
      id,
      text: raw.replace(/<[^>]*>/g, ''),
    })
  }
  return headings
}

async function processFile(
  filePath: string,
  baseDir: string,
  domainMap: Map<string, string>,
  prefixes: string[],
  sectionPrefix: string | null,
): Promise<SiteEntry | null> {
  const raw = fs.readFileSync(filePath, 'utf-8')
  const { data, content } = matter(raw)
  if (!data.title) return null

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, { behavior: 'wrap' })
    .use(rehypeCrossReferences, { domainMap, prefixes })
    .use(rehypeStringify, { allowDangerousHtml: true })

  const result = await processor.process(content)
  const html = String(result)

  let slug: string
  let sectionName: string
  let subsection: string | null
  if (sectionPrefix) {
    const relative = path
      .relative(baseDir, filePath)
      .replace(/\.md$/, '')
      .replace(/[/\\](INDEX|index)$/, '')
    slug = '/' + sectionPrefix + (relative === 'index' || relative === '' ? '' : '/' + relative.split(path.sep).join('/'))
    sectionName = sectionPrefix
    subsection = null
  } else {
    slug = filePathToSlug(filePath, baseDir)
    const derived = deriveSection(slug)
    sectionName = derived.section
    subsection = derived.subsection
  }

  return {
    frontmatter: data as SiteEntry['frontmatter'],
    html,
    raw,
    headings: extractHeadings(html),
    slug,
    domain: typeof data.domain === 'string' ? data.domain : undefined,
    section: sectionName,
    subsection,
  }
}

export default function referenceSitePlugin(options: ReferenceSitePluginOptions): Plugin {
  const { config, contentDir } = options
  const additionalDirs = options.additionalDirs ?? []
  const prefixes = options.crossReferencePrefixes ?? []
  const injectMeta = options.injectMeta !== false

  const plugin: Plugin = {
    name: 'vite-plugin-reference-site',

    resolveId(id: string) {
      if (id === VIRTUAL_MODULE_ID) return RESOLVED_VIRTUAL_MODULE_ID
    },

    async load(id: string) {
      if (id !== RESOLVED_VIRTUAL_MODULE_ID) return

      const allFiles: { file: string; baseDir: string; sectionPrefix: string | null }[] = []
      for (const file of collectMarkdownFiles(contentDir)) {
        allFiles.push({ file, baseDir: contentDir, sectionPrefix: null })
      }
      for (const { dir, section } of additionalDirs) {
        for (const file of collectMarkdownFiles(dir)) {
          allFiles.push({ file, baseDir: dir, sectionPrefix: section })
        }
      }

      const domainMap = new Map<string, string>()
      if (prefixes.length > 0) {
        for (const { file, baseDir, sectionPrefix } of allFiles) {
          const raw = fs.readFileSync(file, 'utf-8')
          const { data } = matter(raw)
          if (typeof data.domain === 'string') {
            const slug = sectionPrefix
              ? '/' + sectionPrefix + '/' + path.relative(baseDir, file).replace(/\.md$/, '').replace(/[/\\](INDEX|index)$/, '')
              : filePathToSlug(file, baseDir)
            domainMap.set(data.domain, slug)
          }
        }
      }

      const results = await Promise.all(
        allFiles.map(({ file, baseDir, sectionPrefix }) =>
          processFile(file, baseDir, domainMap, prefixes, sectionPrefix),
        ),
      )
      const entries = results.filter((e): e is SiteEntry => e !== null)
      return `export default ${JSON.stringify(entries)}`
    },

    configureServer(server) {
      server.watcher.add(contentDir)
      for (const { dir } of additionalDirs) {
        if (fs.existsSync(dir)) server.watcher.add(dir)
      }
      server.watcher.on('change', (changedPath) => {
        const isWatched =
          changedPath.startsWith(contentDir) ||
          additionalDirs.some(({ dir }) => changedPath.startsWith(dir))
        if (isWatched && changedPath.endsWith('.md')) {
          const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MODULE_ID)
          if (mod) {
            server.moduleGraph.invalidateModule(mod)
            server.ws.send({ type: 'full-reload' })
          }
        }
      })
    },
  }

  if (injectMeta) {
    plugin.transformIndexHtml = {
      order: 'pre',
      handler(html: string) {
        return transformIndexHtml(html, config)
      },
    }
  }

  return plugin
}
