'use client'

import { useCurrentRoute } from '@agentic-web-toolkit/model'
import { slugToBreadcrumbs } from '@agentic-web-toolkit/model'
import { Breadcrumbs, type BreadcrumbsProps } from './Breadcrumbs'

export function BreadcrumbsConnected(props: Omit<BreadcrumbsProps, 'trail'>) {
  const { pathname } = useCurrentRoute()
  return <Breadcrumbs trail={slugToBreadcrumbs(pathname)} {...props} />
}
