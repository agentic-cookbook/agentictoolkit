'use client'

import * as React from 'react'
import { Menu as MenuPrimitive } from '@base-ui/react/menu'
import { Check, ChevronRight, Circle } from 'lucide-react'

import { cn } from '../lib/utils'

// Base UI menu styled through the SEMANTIC `adh-dropdown-menu__*` classes
// (skinned in ../styles/components.css) rather than utilities: the class
// names are a public theming surface — the theme editor and user CSS themes
// target them, and chrome like NavigationPopover composes them — so they
// must stay stable hooks in the DOM.

// Pass-through parts are thin function wrappers (not `const X = Primitive.X`
// aliases) so tsc emits clean, self-contained prop types into dist — the same
// pattern as popover.tsx.
function DropdownMenu(props: MenuPrimitive.Root.Props) {
  return <MenuPrimitive.Root {...props} />
}

function DropdownMenuTrigger(props: MenuPrimitive.Trigger.Props) {
  return <MenuPrimitive.Trigger {...props} />
}

function DropdownMenuGroup(props: MenuPrimitive.Group.Props) {
  return <MenuPrimitive.Group {...props} />
}

function DropdownMenuPortal(props: MenuPrimitive.Portal.Props) {
  return <MenuPrimitive.Portal {...props} />
}

function DropdownMenuSub(props: MenuPrimitive.SubmenuRoot.Props) {
  return <MenuPrimitive.SubmenuRoot {...props} />
}

function DropdownMenuRadioGroup(props: MenuPrimitive.RadioGroup.Props) {
  return <MenuPrimitive.RadioGroup {...props} />
}

/** Positioning knobs lifted onto the Content/SubContent wrappers (they live on
 *  Base UI's Positioner, between Portal and Popup). */
type PositionerProps = Pick<
  MenuPrimitive.Positioner.Props,
  'side' | 'sideOffset' | 'align' | 'alignOffset'
>

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: MenuPrimitive.SubmenuTrigger.Props & {
  inset?: boolean
}) {
  return (
    <MenuPrimitive.SubmenuTrigger
      className={cn(
        'adh-dropdown-menu__item adh-dropdown-menu__sub-trigger',
        inset && 'adh-dropdown-menu__item--inset',
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRight className="adh-dropdown-menu__sub-trigger-chevron" />
    </MenuPrimitive.SubmenuTrigger>
  )
}

function DropdownMenuSubContent({
  className,
  side,
  sideOffset,
  align,
  alignOffset,
  ...props
}: MenuPrimitive.Popup.Props & PositionerProps) {
  // No positioning defaults here: a nested menu's Positioner already defaults
  // to side "inline-end" / align "start" — the classic submenu flyout.
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        className="z-50"
      >
        <MenuPrimitive.Popup
          className={cn('adh-dropdown-menu__content', className)}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

function DropdownMenuContent({
  className,
  side,
  sideOffset = 4,
  align,
  alignOffset,
  ...props
}: MenuPrimitive.Popup.Props & PositionerProps) {
  return (
    <MenuPrimitive.Portal>
      <MenuPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        alignOffset={alignOffset}
        className="z-50"
      >
        <MenuPrimitive.Popup
          className={cn('adh-dropdown-menu__content', className)}
          {...props}
        />
      </MenuPrimitive.Positioner>
    </MenuPrimitive.Portal>
  )
}

function DropdownMenuItem({
  className,
  inset,
  accent,
  ...props
}: MenuPrimitive.Item.Props & {
  inset?: boolean
  /** Brand-gold highlight on hover/focus (vs the default neutral surface),
   *  for accent selectors like the focused-item rail picker. */
  accent?: boolean
}) {
  return (
    <MenuPrimitive.Item
      className={cn(
        'adh-dropdown-menu__item',
        inset && 'adh-dropdown-menu__item--inset',
        accent && 'adh-dropdown-menu__item--accent',
        className,
      )}
      {...props}
    />
  )
}

/** A menu item that navigates: renders an `<a>` by default; pass
 *  `render={<Link href=… />}` to navigate through a framework router. Unlike
 *  a plain Item, the engine leaves the browser's link semantics intact
 *  (middle-click, open-in-new-tab) while still closing the menu. */
function DropdownMenuLinkItem({
  className,
  inset,
  accent,
  ...props
}: MenuPrimitive.LinkItem.Props & {
  inset?: boolean
  accent?: boolean
}) {
  return (
    <MenuPrimitive.LinkItem
      className={cn(
        'adh-dropdown-menu__item',
        inset && 'adh-dropdown-menu__item--inset',
        accent && 'adh-dropdown-menu__item--accent',
        className,
      )}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  accent,
  // Base UI defaults checkbox items to keep the menu open on click; this
  // wrapper has always closed it (its original engine's behavior), so keep
  // that as the default and let callers opt out.
  closeOnClick = true,
  ...props
}: MenuPrimitive.CheckboxItem.Props & {
  accent?: boolean
}) {
  return (
    <MenuPrimitive.CheckboxItem
      className={cn(
        'adh-dropdown-menu__item adh-dropdown-menu__item--indicator-left',
        accent && 'adh-dropdown-menu__item--accent',
        className,
      )}
      checked={checked}
      closeOnClick={closeOnClick}
      {...props}
    >
      <span className="adh-dropdown-menu__indicator-slot">
        <MenuPrimitive.CheckboxItemIndicator>
          <Check className="adh-dropdown-menu__indicator-check" />
        </MenuPrimitive.CheckboxItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  )
}

function DropdownMenuRadioItem({
  className,
  children,
  accent,
  // Same closeOnClick default flip as DropdownMenuCheckboxItem above.
  closeOnClick = true,
  ...props
}: MenuPrimitive.RadioItem.Props & {
  accent?: boolean
}) {
  return (
    <MenuPrimitive.RadioItem
      className={cn(
        'adh-dropdown-menu__item adh-dropdown-menu__item--indicator-left',
        accent && 'adh-dropdown-menu__item--accent',
        className,
      )}
      closeOnClick={closeOnClick}
      {...props}
    >
      <span className="adh-dropdown-menu__indicator-slot">
        <MenuPrimitive.RadioItemIndicator>
          <Circle className="adh-dropdown-menu__indicator-dot" />
        </MenuPrimitive.RadioItemIndicator>
      </span>
      {children}
    </MenuPrimitive.RadioItem>
  )
}

// Purely presentational (a styled <div>, exactly what the previous engine
// rendered). Deliberately NOT Base UI's Menu.GroupLabel, which throws when
// rendered outside a <Menu.Group> — this label is also used standalone (e.g.
// the DebugMenu heading).
function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<'div'> & {
  inset?: boolean
}) {
  return (
    <div
      className={cn(
        'adh-dropdown-menu__label',
        inset && 'adh-dropdown-menu__item--inset',
        className,
      )}
      {...props}
    />
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof MenuPrimitive.Separator>) {
  return (
    <MenuPrimitive.Separator
      className={cn('adh-dropdown-menu__separator', className)}
      {...props}
    />
  )
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
}
