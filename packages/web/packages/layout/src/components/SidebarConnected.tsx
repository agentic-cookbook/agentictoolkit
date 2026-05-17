'use client'

import { useContent } from '@agentic-web-toolkit/model'
import { useCurrentRoute } from '@agentic-web-toolkit/model'
import { Sidebar, type SidebarProps } from './Sidebar'

export function SidebarConnected(props: Omit<SidebarProps, 'nodes' | 'currentPath'>) {
  const { navTree } = useContent()
  const { pathname } = useCurrentRoute()
  return <Sidebar nodes={navTree} currentPath={pathname} {...props} />
}
