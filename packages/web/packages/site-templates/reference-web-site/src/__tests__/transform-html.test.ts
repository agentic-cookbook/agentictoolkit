import { describe, it, expect } from 'vitest'
import { transformIndexHtml } from '../vite-plugin/transform-html'
import type { SiteConfig } from '../types'

const baseHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
  </head>
  <body><div id="root"></div></body>
</html>`

const baseConfig: SiteConfig = {
  branding: { title: 'Cookbook', titleEmphasis: 'The' },
  meta: {
    description: 'Recipes for AI-assisted development.',
    siteUrl: 'https://example.com',
    ogImage: '/og.png',
    twitterHandle: '@cookbook',
  },
  hero: { heading: 'h', body: 'b' },
  nav: { sections: [] },
}

describe('transformIndexHtml', () => {
  it('injects a title combining titleEmphasis and title', () => {
    const out = transformIndexHtml(baseHtml, baseConfig)
    expect(out).toContain('<title>The Cookbook</title>')
  })

  it('uses bare title when titleEmphasis is unset', () => {
    const out = transformIndexHtml(baseHtml, {
      ...baseConfig,
      branding: { title: 'Plain' },
    })
    expect(out).toContain('<title>Plain</title>')
  })

  it('injects meta description', () => {
    const out = transformIndexHtml(baseHtml, baseConfig)
    expect(out).toContain('content="Recipes for AI-assisted development."')
  })

  it('injects og:url from config.meta.siteUrl', () => {
    const out = transformIndexHtml(baseHtml, baseConfig)
    expect(out).toContain('property="og:url" content="https://example.com"')
  })

  it('absolutizes a relative ogImage against siteUrl', () => {
    const out = transformIndexHtml(baseHtml, baseConfig)
    expect(out).toContain('property="og:image" content="https://example.com/og.png"')
    expect(out).toContain('name="twitter:image" content="https://example.com/og.png"')
  })

  it('injects twitter:site when twitterHandle is set', () => {
    const out = transformIndexHtml(baseHtml, baseConfig)
    expect(out).toContain('name="twitter:site" content="@cookbook"')
  })

  it('replaces an existing title tag rather than duplicating it', () => {
    const html = baseHtml.replace('<meta charset="UTF-8" />', '<title>OLD</title>')
    const out = transformIndexHtml(html, baseConfig)
    expect(out).toContain('<title>The Cookbook</title>')
    expect(out).not.toContain('<title>OLD</title>')
  })

  it('escapes HTML-significant characters in injected values', () => {
    const out = transformIndexHtml(baseHtml, {
      ...baseConfig,
      branding: { title: 'A & B', titleEmphasis: '<x>' },
    })
    expect(out).toContain('<title>&lt;x&gt; A &amp; B</title>')
  })
})
