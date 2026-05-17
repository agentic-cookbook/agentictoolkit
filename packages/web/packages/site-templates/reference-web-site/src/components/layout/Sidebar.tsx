'use client'

import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { useContent } from '../../contexts/ContentContext'
import type { NavNode } from '../../types'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`h-3 w-3 shrink-0 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  )
}

function FileLink({ node }: { node: NavNode }) {
  const { pathname } = useLocation()
  const isSelected = pathname === node.path
  return (
    <li>
      <Link
        to={node.path}
        aria-current={isSelected ? 'page' : undefined}
        className={`relative block py-0.5 text-sm transition-colors ${
          isSelected
            ? 'font-semibold text-[var(--color-text-primary)]'
            : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
        }`}
        style={{ paddingInlineStart: '0.875rem' }}
      >
        {isSelected && (
          <span className="absolute left-0 top-0.5 bottom-0.5 w-px bg-[var(--color-accent)]" />
        )}
        {node.label}
      </Link>
    </li>
  )
}

function DirLink({ node }: { node: NavNode }) {
  const { pathname } = useLocation()
  const isSelected = pathname === node.path
  const isAncestor = pathname.startsWith(node.path + '/')
  const childDirs = node.children.filter((c) => c.children.length > 0)
  const childFiles = node.children.filter((c) => c.children.length === 0)

  return (
    <>
      <li>
        <Link
          to={node.path}
          aria-current={isSelected ? 'page' : undefined}
          className={`relative block py-1 text-sm transition-colors ${
            isSelected
              ? 'font-semibold text-[var(--color-text-primary)]'
              : isAncestor
                ? 'font-medium text-[var(--color-text-primary)]'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
          }`}
          style={{ paddingInlineStart: '0.875rem' }}
        >
          {isSelected && (
            <span className="absolute left-0 top-1 bottom-1 w-px bg-[var(--color-accent)]" />
          )}
          {node.label}
        </Link>
      </li>
      {(childDirs.length > 0 || childFiles.length > 0) && (
        <li>
          <ul className="flex flex-col border-l border-[var(--color-border)] ml-3.5">
            {childFiles.map((child) => (
              <FileLink key={child.path} node={child} />
            ))}
            {childDirs.map((child) => (
              <DirLink key={child.path} node={child} />
            ))}
          </ul>
        </li>
      )}
    </>
  )
}

function NavSection({ node }: { node: NavNode }) {
  const { pathname } = useLocation()
  const isSelected = pathname === node.path
  const isInSection = pathname.startsWith(node.path + '/')
  const [expanded, setExpanded] = useState(isSelected || isInSection)
  const childDirs = node.children.filter((c) => c.children.length > 0)
  const childFiles = node.children.filter((c) => c.children.length === 0)

  return (
    <div className="flex flex-col gap-1">
      <div className="relative flex items-center gap-1">
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-0.5 text-[var(--color-text-dim)] hover:text-[var(--color-text-secondary)] transition-colors"
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${node.label}`}
        >
          <Chevron expanded={expanded} />
        </button>
        {isSelected && (
          <span className="absolute -left-6 top-0 bottom-0 w-0.5 bg-[var(--color-accent)]" />
        )}
        <Link
          to={node.path}
          className="font-mono text-xs font-medium uppercase tracking-widest text-[var(--color-accent)] transition-colors"
        >
          {node.label}
        </Link>
      </div>
      {expanded && (childDirs.length > 0 || childFiles.length > 0) && (
        <ul className="flex flex-col border-l border-[var(--color-border)] mt-1">
          {childFiles.map((child) => (
            <FileLink key={child.path} node={child} />
          ))}
          {childDirs.map((child) => (
            <DirLink key={child.path} node={child} />
          ))}
        </ul>
      )}
    </div>
  )
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { navTree } = useContent()
  const { pathname } = useLocation()
  const isHomeSelected = pathname === '/'

  const nav = (
    <nav className="flex flex-col gap-6 px-6 py-6 overflow-y-auto h-full">
      <div className="flex flex-col gap-3">
        <h3 className="relative font-mono text-xs font-medium uppercase tracking-widest text-[var(--color-accent)] transition-colors">
          {isHomeSelected && (
            <span className="absolute -left-6 top-0 bottom-0 w-0.5 bg-[var(--color-accent)]" />
          )}
          <Link to="/" className="hover:text-[var(--color-accent)]">
            Overview
          </Link>
        </h3>
      </div>
      {navTree.map((section) => (
        <NavSection key={section.path} node={section} />
      ))}
    </nav>
  )

  return (
    <>
      <aside className="hidden lg:block w-80 shrink-0 border-r border-[var(--color-border-subtle)] overflow-y-auto sticky top-14 h-[calc(100vh-3.5rem)]">
        {nav}
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={onClose} />
          <aside className="fixed inset-y-0 left-0 w-72 bg-[var(--color-surface)] shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-subtle)]">
              <span className="font-mono text-sm font-medium text-[var(--color-text-primary)]">
                Navigation
              </span>
              <button
                onClick={onClose}
                className="p-1 text-[var(--color-text-dim)] hover:text-[var(--color-text-primary)]"
                aria-label="Close navigation"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {nav}
          </aside>
        </div>
      )}
    </>
  )
}
