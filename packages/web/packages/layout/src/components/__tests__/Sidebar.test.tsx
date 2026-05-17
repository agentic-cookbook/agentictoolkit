import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { Sidebar } from '../Sidebar'
import type { NavNode } from '@agentic-web-toolkit/model'

const tree: NavNode[] = [
  {
    label: 'Guides',
    path: '/guides',
    children: [
      { label: 'Install', path: '/guides/install', children: [] },
      { label: 'Configure', path: '/guides/configure', children: [] },
    ],
  },
]

describe('Sidebar', () => {
  it('renders one section per top-level node', () => {
    const { container } = render(<Sidebar nodes={tree} currentPath="/" />)
    expect(container.querySelectorAll('.awt-sidebar__section')).toHaveLength(1)
  })

  it('renders one item per leaf', () => {
    const { container } = render(<Sidebar nodes={tree} currentPath="/" />)
    expect(container.querySelectorAll('.awt-sidebar__item')).toHaveLength(2)
  })

  it('marks the current path as active', () => {
    const { container } = render(<Sidebar nodes={tree} currentPath="/guides/install" />)
    const active = container.querySelector('.awt-sidebar__item--active')
    expect(active?.textContent).toContain('Install')
  })

  it('fires onNavigate when an item is clicked', () => {
    const onNavigate = vi.fn()
    const { getByText } = render(<Sidebar nodes={tree} currentPath="/" onNavigate={onNavigate} />)
    fireEvent.click(getByText('Configure'))
    expect(onNavigate).toHaveBeenCalledWith('/guides/configure')
  })

  it('renders nested children recursively', () => {
    const nested: NavNode[] = [
      {
        label: 'Top',
        path: '/top',
        children: [
          {
            label: 'Group',
            path: '/top/group',
            children: [
              { label: 'Leaf', path: '/top/group/leaf', children: [] },
            ],
          },
        ],
      },
    ]
    const { getByText } = render(<Sidebar nodes={nested} currentPath="/" />)
    expect(getByText('Leaf')).toBeTruthy()
    expect(getByText('Group')).toBeTruthy()
  })
})
