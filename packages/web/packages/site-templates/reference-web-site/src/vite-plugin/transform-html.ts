import type { SiteConfig } from '../types'

export function transformIndexHtml(html: string, config: SiteConfig): string {
  const fullTitle = config.branding.titleEmphasis
    ? `${config.branding.titleEmphasis} ${config.branding.title}`
    : config.branding.title

  const tags = [
    `<title>${escapeHtml(fullTitle)}</title>`,
    `<meta name="description" content="${escapeHtml(config.meta.description)}" />`,
    `<meta property="og:title" content="${escapeHtml(fullTitle)}" />`,
    `<meta property="og:description" content="${escapeHtml(config.meta.description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:url" content="${escapeHtml(config.meta.siteUrl)}" />`,
    config.meta.ogImage
      ? `<meta property="og:image" content="${escapeHtml(absoluteUrl(config.meta.ogImage, config.meta.siteUrl))}" />`
      : '',
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(fullTitle)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(config.meta.description)}" />`,
    config.meta.ogImage
      ? `<meta name="twitter:image" content="${escapeHtml(absoluteUrl(config.meta.ogImage, config.meta.siteUrl))}" />`
      : '',
    config.meta.twitterHandle
      ? `<meta name="twitter:site" content="${escapeHtml(config.meta.twitterHandle)}" />`
      : '',
  ]
    .filter(Boolean)
    .join('\n    ')

  let result = html

  if (/<title>[^<]*<\/title>/i.test(result)) {
    result = result.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(fullTitle)}</title>`)
    const remainingTags = tags
      .split('\n    ')
      .filter((t) => !t.startsWith('<title>'))
      .join('\n    ')
    result = result.replace(/<\/head>/i, `    ${remainingTags}\n  </head>`)
  } else {
    result = result.replace(/<\/head>/i, `    ${tags}\n  </head>`)
  }

  return result
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function absoluteUrl(maybeRelative: string, base: string): string {
  if (/^https?:\/\//i.test(maybeRelative)) return maybeRelative
  const stripped = base.replace(/\/$/, '')
  const path = maybeRelative.startsWith('/') ? maybeRelative : '/' + maybeRelative
  return stripped + path
}
