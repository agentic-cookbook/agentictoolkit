---
title: Configuration
summary: The SiteConfig shape — branding, meta, hero, nav, theme, features.
---

# Configuration

`SiteConfig` is a single typed object. Everything that's site-specific
lives there.

## Branding

```ts
branding: {
  title: 'Cookbook',
  titleEmphasis: 'The',          // optional italic prefix in the logo
  githubUrl: 'https://github.com/...',
  logoHref: '/',                 // defaults to "/"
}
```

## Nav sections

Each section becomes a top-level group in the sidebar and a card on the
homepage. Markdown files under a directory matching the section's `key`
land in that section automatically.

```ts
nav: {
  sections: [
    { key: 'docs', label: 'Docs', path: '/docs', description: '…' },
    { key: 'guides', label: 'Guides', path: '/guides', description: '…' },
  ],
  externalLinks: [
    { label: 'Sister Site', href: 'https://…', description: '…' },
  ],
}
```

## Features

Toggle built-in chrome:

```ts
features: {
  search: true,   // ⌘K dialog (default true)
  toc: true,      // right-side per-page TOC (default true)
}
```
