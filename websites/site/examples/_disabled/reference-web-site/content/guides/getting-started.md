---
title: Getting started
summary: Install the package and wire it into a fresh Vite app.
---

# Getting started

The package ships as part of `agentic-web-toolkit`. Wire it into a Vite +
React app in four files.

## 1. Install

```sh
npm install agentic-web-toolkit
```

## 2. Configure

Create `site.config.tsx`:

```tsx
import type { SiteConfig } from 'agentic-web-toolkit/reference-web-site'

export const siteConfig: SiteConfig = {
  branding: { title: 'My Site' },
  meta: { description: '...', siteUrl: 'https://example.com' },
  hero: { heading: 'My Site', body: <p>Welcome.</p> },
  nav: { sections: [{ key: 'docs', label: 'Docs', path: '/docs' }] },
}
```

## 3. Plug into Vite

```ts
import { referenceSitePlugin } from 'agentic-web-toolkit/reference-web-site/vite'
import { siteConfig } from './site.config.tsx'

export default defineConfig({
  plugins: [
    react(),
    referenceSitePlugin({ config: siteConfig, contentDir: './content' }),
  ],
})
```

## 4. Render

```tsx
import { ReferenceSite } from 'agentic-web-toolkit/reference-web-site'
import { siteConfig } from './site.config.tsx'

createRoot(root).render(<ReferenceSite config={siteConfig} />)
```
