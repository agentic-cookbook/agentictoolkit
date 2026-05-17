import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import referenceSitePlugin from '../vite-plugin/plugin'
import type { SiteConfig } from '../types'

const VIRTUAL_ID = 'virtual:reference-site-content'
const RESOLVED_ID = '\0' + VIRTUAL_ID

const config: SiteConfig = {
  branding: { title: 'Test' },
  meta: { description: 'd', siteUrl: 'https://example.com' },
  hero: { heading: 'h', body: 'b' },
  nav: { sections: [] },
}

let tmpDir: string

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ref-site-plugin-'))
  fs.mkdirSync(path.join(tmpDir, 'docs'), { recursive: true })
  fs.writeFileSync(
    path.join(tmpDir, 'docs', 'intro.md'),
    `---\ntitle: Intro\nsummary: First doc\n---\n\n# Hello\n\nBody text.\n`,
  )
  fs.writeFileSync(
    path.join(tmpDir, 'docs', 'untitled.md'),
    `---\nsummary: no title\n---\n\nshould be skipped`,
  )
})

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true })
})

describe('referenceSitePlugin', () => {
  it('resolves the virtual module id', () => {
    const plugin = referenceSitePlugin({ config, contentDir: tmpDir })
    const resolve = plugin.resolveId as (id: string) => string | undefined
    expect(resolve.call({} as never, VIRTUAL_ID)).toBe(RESOLVED_ID)
    expect(resolve.call({} as never, 'something-else')).toBeUndefined()
  })

  it('builds entries from markdown files with frontmatter title', async () => {
    const plugin = referenceSitePlugin({ config, contentDir: tmpDir })
    const load = plugin.load as (id: string) => Promise<string | undefined>
    const code = await load.call({} as never, RESOLVED_ID)
    expect(code).toBeTruthy()
    const entries = JSON.parse(code!.replace(/^export default /, ''))
    expect(Array.isArray(entries)).toBe(true)
    expect(entries).toHaveLength(1)
    expect(entries[0].slug).toBe('/docs/intro')
    expect(entries[0].section).toBe('docs')
    expect(entries[0].frontmatter.title).toBe('Intro')
    expect(entries[0].frontmatter.summary).toBe('First doc')
    expect(entries[0].html).toContain('Hello')
  })

  it('returns the configured plugin name and exposes transformIndexHtml', () => {
    const plugin = referenceSitePlugin({ config, contentDir: tmpDir })
    expect(plugin.name).toBe('vite-plugin-reference-site')
    expect(plugin.transformIndexHtml).toBeDefined()
  })
})
