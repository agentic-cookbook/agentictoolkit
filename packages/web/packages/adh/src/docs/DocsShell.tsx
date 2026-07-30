// NO "use client" — a server component. The sidebar is real `next/link` anchors (crawlable) with
// server-computed active state, and the content pane is whatever SSR'd node the route passes as
// `children` (typically {@link MarkdownHtml} injecting a slug's pre-rendered HTML). Mobile nav is a
// native <details> disclosure, so the whole shell needs no client JavaScript.

import Link from 'next/link'
import type { ReactNode } from 'react'
import { DOCS_NAV, docsHref, type DocsNavSection } from './nav'

export interface DocsShellProps {
  /** Site base path with NO trailing slash: `/docs` on the help site, `` (or `/`) on the docs site. */
  basePath: string
  /** The active page's base-relative slug (`''` = the index), for highlighting the current row. */
  currentSlug: string
  /** Sidebar title (e.g. the site name). */
  title?: string
  /** The nav structure; defaults to the shared {@link DOCS_NAV}. */
  nav?: DocsNavSection[]
  /** The SSR'd page body (e.g. `<MarkdownHtml html={getDocHtml(slug)!} />`). */
  children: ReactNode
}

/**
 * The shared ADH documentation shell: a sticky link sidebar + an article column, styled with the
 * ADH `--mdv-*` / apt tokens (no third-party docs framework). One structure for the `help` and
 * `docs` sites — each supplies its own `basePath`, so a single {@link DOCS_NAV} drives both despite
 * their different URL prefixes. Wrap it in the site's `AppShell` for the header/footer chrome.
 */
export function DocsShell({ basePath, currentSlug, title = 'Documentation', nav = DOCS_NAV, children }: DocsShellProps) {
  const list = (
    <ul className="adh-docs__nav-list">
      {nav.map((section, i) => (
        <li className="adh-docs__nav-section" key={section.label ?? `_${i}`}>
          {section.label && <p className="adh-docs__nav-heading">{section.label}</p>}
          <ul className="adh-docs__nav-sublist">
            {section.links.map((link) => {
              const active = link.slug === currentSlug
              return (
                <li key={link.slug || '_index'}>
                  <Link
                    href={docsHref(basePath, link.slug)}
                    className={active ? 'adh-docs__nav-link adh-docs__nav-link--active' : 'adh-docs__nav-link'}
                    aria-current={active ? 'page' : undefined}
                  >
                    {link.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </li>
      ))}
    </ul>
  )

  return (
    <div className="adh-docs">
      {/* Desktop: a persistent sticky sidebar. */}
      <aside className="adh-docs__sidebar" aria-label={`${title} navigation`}>
        <p className="adh-docs__sidebar-title">{title}</p>
        {list}
      </aside>
      {/* Mobile: the same links behind a no-JS <details> disclosure. */}
      <details className="adh-docs__mobile">
        <summary className="adh-docs__mobile-summary">{title} menu</summary>
        {list}
      </details>
      <main className="adh-docs__main">
        {/* The prose class lives on MarkdownHtml's own wrapper; the article is just layout. */}
        <article className="adh-docs__article">{children}</article>
      </main>
    </div>
  )
}
