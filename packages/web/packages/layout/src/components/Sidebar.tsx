'use client'

import type { ReactNode } from 'react'
import { useLink, type LinkComponent } from '@agentic-toolkit/model'
import type { NavNode } from '@agentic-toolkit/model'

export type SidebarProps = {
  nodes: NavNode[]
  currentPath: string
  onNavigate?: (path: string) => void
  emptyState?: ReactNode
}

function renderItem(
  node: NavNode,
  currentPath: string,
  onNavigate: ((p: string) => void) | undefined,
  Link: LinkComponent,
): ReactNode {
  const isActive = node.path === currentPath
  if (node.children.length === 0) {
    return (
      <li
        key={node.path}
        className={`awt-sidebar__item${isActive ? ' awt-sidebar__item--active' : ''}`}
      >
        {onNavigate ? (
          <button type="button" onClick={() => onNavigate(node.path)}>
            {node.label}
          </button>
        ) : (
          <Link to={node.path}>{node.label}</Link>
        )}
      </li>
    )
  }
  return (
    <li key={node.path} className="awt-sidebar__group">
      <div className="awt-sidebar__group-label">{node.label}</div>
      <ul className="awt-sidebar__list awt-sidebar__list--nested">
        {node.children.map((c) => renderItem(c, currentPath, onNavigate, Link))}
      </ul>
    </li>
  )
}

export function Sidebar({ nodes, currentPath, onNavigate, emptyState }: SidebarProps) {
  const Link = useLink()
  if (nodes.length === 0) {
    return <aside className="awt-sidebar">{emptyState ?? null}</aside>
  }
  return (
    <aside className="awt-sidebar" aria-label="Site navigation">
      {nodes.map((section) => (
        <div key={section.path} className="awt-sidebar__section">
          <h2 className="awt-sidebar__section-header">{section.label}</h2>
          <ul className="awt-sidebar__list">
            {section.children.map((c) => renderItem(c, currentPath, onNavigate, Link))}
          </ul>
        </div>
      ))}
    </aside>
  )
}
