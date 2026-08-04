/** Unit tests for the dropdown-menu wrappers (Base UI Menu engine) and Avatar.
 *  Real Base-UI floating parts render in jsdom thanks to the rect/
 *  getComputedStyle stubs in vitest.setup. These pin the wrapper CONTRACT the
 *  chrome depends on: the `adh-dropdown-menu__*`/`adh-avatar*` theming classes
 *  stay in the DOM, the trigger exposes `data-popup-open` (the CSS hook), and
 *  radio/checkbox selection closes the menu (this wrapper's historical
 *  behavior — Base UI's own default keeps it open). */
/// <reference types="@testing-library/jest-dom/vitest" />
import * as React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuCheckboxItem,
} from '../components/dropdown-menu'
import { Avatar, AvatarFallback } from '../components/avatar'

function trigger(): HTMLElement {
  return screen.getByRole('button', { name: 'Open' })
}

async function openMenu(): Promise<void> {
  fireEvent.click(trigger())
  await waitFor(() => expect(screen.getByRole('menu')).toBeInTheDocument())
}

describe('DropdownMenu — open/close contract', () => {
  it('opens on trigger click and marks the trigger with data-popup-open', async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Section</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>First</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    expect(trigger()).not.toHaveAttribute('data-popup-open')
    await openMenu()
    // data-popup-open is the styling hook the chrome CSS keys on
    // (.adh-avatar-menu-trigger[data-popup-open] etc.) — it must stay.
    expect(trigger()).toHaveAttribute('data-popup-open')
    expect(screen.getByRole('menuitem', { name: 'First' })).toHaveClass('adh-dropdown-menu__item')
    // The standalone label must render (Base UI's GroupLabel would throw here).
    expect(screen.getByText('Section')).toHaveClass('adh-dropdown-menu__label')
  })

  it('fires onClick and closes the menu when an item is clicked', async () => {
    const onClick = vi.fn()
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={onClick}>Do it</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    await openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Do it' }))
    expect(onClick).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  })

  it('renders LinkItem as a real anchor with the item theming class', async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLinkItem render={<a href="/settings" />}>Settings</DropdownMenuLinkItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    await openMenu()
    const link = screen.getByRole('menuitem', { name: 'Settings' })
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('href', '/settings')
    expect(link).toHaveClass('adh-dropdown-menu__item')
  })

  // Base UI's LinkItem keeps the menu OPEN on click (it assumes following the link
  // unmounts the page). Every consumer here navigates client-side through a router,
  // so the page survives and the menu was left hanging open over the new route.
  it('closes the menu when a link item is chosen', async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLinkItem render={<a href="/settings" />}>Settings</DropdownMenuLinkItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    await openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Settings' }))
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  })

  it('lets a caller keep the menu open on a link item', async () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLinkItem render={<a href="/settings" />} closeOnClick={false}>
            Settings
          </DropdownMenuLinkItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    await openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: 'Settings' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })
})

describe('DropdownMenu — selection closes the menu (wrapper default)', () => {
  it('radio item select fires onValueChange and closes', async () => {
    const onValueChange = vi.fn()
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup value="a" onValueChange={onValueChange}>
            <DropdownMenuRadioItem value="a">Alpha</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="b">Beta</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    await openMenu()
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Beta' }))
    expect(onValueChange).toHaveBeenCalledWith('b', expect.anything())
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  })

  it('checkbox item select fires onCheckedChange and closes', async () => {
    const onCheckedChange = vi.fn()
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem checked={false} onCheckedChange={onCheckedChange}>
            Enabled
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    await openMenu()
    fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Enabled' }))
    expect(onCheckedChange).toHaveBeenCalledWith(true, expect.anything())
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  })
})

describe('Avatar', () => {
  it('renders the fallback with the avatar theming classes', () => {
    render(
      <Avatar>
        <AvatarFallback>MF</AvatarFallback>
      </Avatar>,
    )
    const fallback = screen.getByText('MF')
    expect(fallback).toHaveClass('adh-avatar__fallback')
    expect(fallback.parentElement).toHaveClass('adh-avatar')
  })
})
