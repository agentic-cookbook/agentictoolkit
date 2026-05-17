'use client'

import { useContent } from '@agentic-web-toolkit/model'
import { useCurrentRoute } from '@agentic-web-toolkit/model'
import { TableOfContents, type TableOfContentsProps } from './TableOfContents'

export function TableOfContentsConnected(props: Omit<TableOfContentsProps, 'headings'>) {
  const { findBySlug } = useContent()
  const { pathname } = useCurrentRoute()
  const entry = findBySlug(pathname)
  return <TableOfContents headings={entry?.headings ?? []} {...props} />
}
