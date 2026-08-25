import { describe, it, expect } from 'vitest'
import { defineSite } from '../site/SiteConfig'
import { SITE_TITLE_HELP_ID } from '@agentic-toolkit/adh-ui/help-ids'

// SiteSeo requires exactly `title` and `description` (seo/metadata.ts:39-50); every
// other field is optional, so this is a complete value.
const base = {
  id: 'cookbook' as const,
  seo: { title: 'Cookbook', description: 'The shared playbook.' },
  sitemap: [],
}

describe('defineSite help', () => {
  it('derives the site-title entry from the SEO description', () => {
    const site = defineSite(base)
    expect(site.shell.help?.[SITE_TITLE_HELP_ID]).toEqual({
      body: 'The shared playbook.',
      flavor: 'info',
    })
  })

  it('lets a site override the derived entry', () => {
    const site = defineSite({
      ...base,
      help: { [SITE_TITLE_HELP_ID]: { body: 'Something else.', flavor: 'help' } },
    })
    expect(site.shell.help?.[SITE_TITLE_HELP_ID]).toEqual({
      body: 'Something else.',
      flavor: 'help',
    })
  })

  it('keeps a site’s other entries alongside the derived one', () => {
    const site = defineSite({ ...base, help: { widget: { body: 'A widget.' } } })
    expect(site.shell.help?.widget).toEqual({ body: 'A widget.' })
    expect(site.shell.help?.[SITE_TITLE_HELP_ID]?.body).toBe('The shared playbook.')
  })
})
