// NO 'use client' — a server component. The API reference shell: a crawlable sidebar of real
// next/link anchors (Tags → Endpoints, current highlighted server-side) beside the endpoint
// article. The client, interactive ApiBrowser (rails + try-it) is unchanged and still used by
// authenticated surfaces; this is the SSR reference layout for the public, per-endpoint-URL site.

import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@agentic-toolkit/ui'
import { allTags, endpointsForTag } from './lib/getEndpoint'
import { endpointSlug } from './lib/slug'
import { methodDotClass } from './lib/tone'
import type { EndpointMeta } from './types'

export interface ApiReferenceShellProps {
  /** Site base path with NO trailing slash (`` when endpoints live at the site root). */
  basePath: string
  /** The active endpoint's map key, for highlighting its row. `undefined` on the index. */
  currentKey?: string
  /** Sidebar title. */
  title?: string
  /** The SSR'd endpoint body (e.g. `<ApiEndpointReference meta={…} />`) or the index landing. */
  children: ReactNode
}

/** Absolute href for an endpoint's reference page. */
export function endpointHref(basePath: string, meta: EndpointMeta): string {
  const slug = endpointSlug(meta).join('/')
  return basePath === '/' ? `/${slug}` : `${basePath}/${slug}`
}

export function ApiReferenceShell({ basePath, currentKey, title = 'API Reference', children }: ApiReferenceShellProps) {
  const homeHref = basePath === '' ? '/' : basePath
  const nav = (
    <ul className="adh-api-nav">
      {allTags().map((tag) => (
        <li key={tag} className="adh-api-nav__group">
          <p className="adh-api-nav__heading">{tag}</p>
          <ul className="adh-api-nav__list">
            {endpointsForTag(tag).map((m) => {
              const active = m.key === currentKey
              return (
                <li key={m.key}>
                  <Link
                    href={endpointHref(basePath, m)}
                    className={active ? 'adh-api-nav__link adh-api-nav__link--active' : 'adh-api-nav__link'}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span aria-hidden className={cn('adh-api-nav__dot', methodDotClass(m.method))} />
                    <span className="adh-api-nav__method">{m.method}</span>
                    <span className="adh-api-nav__path">{m.path}</span>
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
    <div className="adh-api-ref">
      <aside className="adh-api-ref__sidebar" aria-label={`${title} navigation`}>
        <Link href={homeHref} className="adh-api-ref__title">
          {title}
        </Link>
        {nav}
      </aside>
      <details className="adh-api-ref__mobile">
        <summary className="adh-api-ref__mobile-summary">{title} menu</summary>
        {nav}
      </details>
      <main className="adh-api-ref__main">{children}</main>
    </div>
  )
}
